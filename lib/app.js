var bugzilla = require('./bugzilla');
var github = require('./github');
var pulse = require('./pulse');
var koa = require('koa');
var thunkify = require('thunkify');

module.exports = function * createApp(config) {
  var app = koa();
  app.use(require('koa-body-parser')());
  app.use(require('koa-trie-router')(app));

  var runtime = {
    config: config,
    githubApi: yield github.initApi(config),
    bugzillaApi: yield bugzilla.initApi(config),
    pulseApi: yield pulse.initApi(config)
  };

  var githubEvents = {
    pull_request: require('../routes/pull_request')(runtime)
  };

  var pulseEvents = {
    pulse_bug: require('../routes/pulse_bug')(runtime)
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
