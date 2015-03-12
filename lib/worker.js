var azureTable = require('azure-table-node');
var bugzilla = require('./bugzilla');
var debug = require('debug')('autolander:worker');
var github = require('./github');
var pulse = require('./pulse');
var taskPulse = require('./task_pulse');

module.exports = function * createApp(config) {

  azureTable.setDefaultClient(config.azureConfig);
  var azureApi = azureTable.getDefaultClient();
  var bugStore = require('./store/bug');
  var activeStore = require('./store/active');

  var runtime = {
    config: config,
    activeStore: yield activeStore.init(config, azureApi),
    bugStore: yield bugStore.init(config, azureApi),
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

  // Dump memory usage every 30s.
  if (config.debug && config.debug.dumpMemoryUsage) {
    setInterval(function() {
      debug('dumpMemoryUsage', process.memoryUsage());
    }, 30000);
  }
}
