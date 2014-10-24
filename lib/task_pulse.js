var co = require('co');
var debug = require('debug')('autolander:task_pulse');
var taskgraph = require('./taskgraph');
var thunkify = require('thunkify');

var PulseListener = require('taskcluster-client').PulseListener;
var SchedulerEvents =  require('taskcluster-client').SchedulerEvents;

function TaskPulse(config) {
  this.config = config;
}

TaskPulse.prototype = {
  init: function * () {
    debug('creating taskcluster pulse listener');
    var listener = new PulseListener({credentials: {
      username: this.config.taskPulseConfig.username,
      password: this.config.taskPulseConfig.password
    }});

    var events = new SchedulerEvents();
    var route = 'route.' + taskgraph.TASKCLUSTER_ROUTE + '.#';
    listener.bind(events.taskGraphRunning(route));
    listener.bind(events.taskGraphBlocked(route));
    listener.bind(events.taskGraphFinished(route));

    var self = this;
    listener.on('message', co(function * (msg) {
      yield self._handler(msg);
    }));
    yield listener.resume();

    return this;
  },

  /**
   * Sets the handler for taskgraph updates.
   */
  setHandler: function(handler) {
    this._handler = handler;
  }
};

/**
 * Initializes listening to amqp messages.
 */
exports.init = function * (config) {
  var taskPulseApi = new TaskPulse(config);
  return yield taskPulseApi.init();
}
