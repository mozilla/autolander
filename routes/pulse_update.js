var bugzilla = require('../lib/bugzilla');
var debug = require('debug')('autolander:route:pulse_update');
var github = require('../lib/github');

/**
 * Called when we receive an update from pulse.
 * @param {Object} runtime
 * @param {Object} pulse The update object from pulse.
 */
module.exports = function(runtime) {
  return function * (pulse) {
    var bugId = pulse.id;

    var isSubscribed = yield runtime.pulseApi.isSubscribed(runtime, bugId);
    if (!isSubscribed) {
      return;
    }

    debug('route', 'bug ' + bugId);
    yield bugzilla.processAttachments(runtime, bugId);
  };
};
