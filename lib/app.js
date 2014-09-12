var bz = require('bz');
var GitHubApi = require('node-github');
var koa = require('koa');

function createBugzillaApi(config) {
  config.bugzillaConfig.timeout = 30000;
  return bz.createClient(config.bugzillaConfig || {});
}

function createGithubApi(config) {
  var githubApi = new GitHubApi({
    version: '3.0.0',
    debug: true,
    protocol: 'https',
    host: config.host,
    pathPrefix: '/api/v3',
    timeout: 5000
  });

  githubApi.authenticate({
    type: "oauth",
    token: config.token
  });

  return githubApi;
}

module.exports = function * createApp(config) {
  var app = koa();
  app.use(require('koa-body-parser')());
  app.use(require('koa-trie-router')(app));

  var runtime = {
    config: config,
    githubApi: createGithubApi(config),
    bugzillaApi: createBugzillaApi(config)
  };

  var githubEvents = {
    pull_request: require('../routes/pull_request')(runtime)
  };

  app.post('/github', function * () {
    var eventName = this.get('X-GitHub-Event');
    if (!eventName) {
      this.throw(400, 'Hook must contain event type');
      return;
    }

    if (!githubEvents[eventName]) {
      this.throw(400, 'Cannot handle "' + eventName + '" events');
      return;
    }

    yield githubEvents[eventName];
  });

  return app;
}
