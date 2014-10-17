var bugzilla = require('./bugzilla');
var github = require('./github');
var pulse = require('./pulse');
var koa = require('koa');

module.exports = function * createApp(config) {
  var app = koa();
  app.use(require('koa-body-parser')());
  app.use(require('koa-trie-router')(app));

  var bugStore = require('./bug_store');

  var runtime = {
    config: config,
    bugStore: yield bugStore.init(config),
    githubApi: yield github.init(config),
    bugzillaApi: yield bugzilla.init(config),
    pulseApi: yield pulse.init(config)
  };

  var githubEvents = {
    pull_request: require('../routes/pull_request')(runtime)
  };

  var pulseEvents = {
    pulse_update: require('../routes/pulse_update')(runtime)
  };

  runtime.pulseApi.setHandler(function * (response) {
    yield pulseEvents.pulse_update(response.payload);
  });

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
