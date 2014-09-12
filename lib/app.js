var GitHubApi = require('node-github');
var koa = require('koa');

module.exports = function * createApp(config) {
  var app = koa();
  app.use(require('koa-body-parser')());
  app.use(require('koa-trie-router')(app));

  var githubApi = new GitHubApi({
    version: '3.0.0',
    debug: true,
    protocol: 'https',
    host: 'github.my-GHE-enabled-company.com',
    pathPrefix: '/api/v3',
    timeout: 5000
  });

  githubApi.authenticate({
    type: "oauth",
    token: config.token
  });

  var runtime = {
    config: config,
    githubApi: githubApi
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
