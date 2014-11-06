var bugzilla = require('./bugzilla');
var debug = require('debug')('autolander:worker');
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
      try {
        yield events.pull_request(response.meta);
      } catch(e) {
        debug('error processing pull request', e);
      }
      return;
    }

    try {
      yield events.pulse_update(response.payload);
    } catch(e) {
      debug('error processing pulse update', e);
    }
  });

  runtime.taskPulse.setHandler(function * (response) {
    yield events.taskgraph_update(response);
  });
}
