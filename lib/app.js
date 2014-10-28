var bugzilla = require('./bugzilla');
var github = require('./github');
var pulse = require('./pulse');
var taskPulse = require('./task_pulse');
var koa = require('koa');
var debug = require('debug')('autolander:app');

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
    pulseApi: yield pulse.init(config),
    taskPulse: yield taskPulse.init(config)
  };

  var githubEvents = {
    pull_request: require('../routes/pull_request')(runtime)
  };

  var pulseEvents = {
    pulse_update: require('../routes/pulse_update')(runtime),
    taskgraph_update: require('../routes/taskgraph_update')(runtime)
  };

  runtime.pulseApi.setHandler(function * (response) {
    yield pulseEvents.pulse_update(response.payload);
  });

  runtime.taskPulse.setHandler(function * (response) {
    yield pulseEvents.taskgraph_update(response);
  });

  app.post('/github', function * () {
    var eventName = this.get('X-GitHub-Event');
    if (!eventName) {
      this.throw(400, 'Hook must contain event type');
      return;
    }

    if (!githubEvents[eventName]) {
      debug('no handler for github event', eventName);
      return;
    }

    yield githubEvents[eventName];
  });

  return app;
}
