var bugzilla = require('./bugzilla');
var github = require('./github');
var pulse = require('./pulse');
var taskPulse = require('./task_pulse');

module.exports = function * createApp(config) {
  var bugStore = require('./bug_store');

  var runtime = {
    config: config,
    bugStore: yield bugStore.init(config),
    githubApi: yield github.init(config),
    bugzillaApi: yield bugzilla.init(config),
    pulseApi: yield pulse.init(config),
    taskPulse: yield taskPulse.init(config)
  };

  var events = {
    pull_request: require('../routes/pull_request')(runtime),
    pulse_update: require('../routes/pulse_update')(runtime),
    taskgraph_update: require('../routes/taskgraph_update')(runtime)
  };

  runtime.pulseApi.setHandler(function * (response) {

    // The pulse API is currently also handling github requests
    if (response.source && response.source  === 'github') {
      yield events.pull_request(response.meta);
      return;
    }

    yield events.pulse_update(response.payload);
  });

  runtime.taskPulse.setHandler(function * (response) {
    yield events.taskgraph_update(response);
  });
}
