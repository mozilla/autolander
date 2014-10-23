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

    // Create the integration branch if needed.
    var pulls = yield bugzilla.getActivePullsForBug(runtime, bugId)

    if (!pulls.length) {
      debug('nothing to process');
      return;
    }

    for (var i = 0, iLen = pulls.length; i < iLen; i++) {
      var pull = pulls[i];
      yield github.integratePullRequest(runtime, pull);
    }

    // Unsubscribe from the bug.
    // XXX: Commented out for testing.
    // yield runtime.pulseApi.unsubscribe(runtime, bugId);
  };
};
