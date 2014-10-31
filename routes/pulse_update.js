var bugzilla = require('../lib/bugzilla');
var debug = require('debug')('autolander:route:pulse_update');
var github = require('../lib/github');
var thunkify = require('thunkify');

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

    // Get the bug.
    var getBug = thunkify(runtime.bugzillaApi.getBug.bind(runtime.bugzillaApi));
    var bug = yield getBug(bugId);

    // Get the active pull requests.
    var pulls = yield bugzilla.getOpenPullsForBug(runtime, bug, bugzilla.canLand)

    // Unsubscribe if there are no open pulls for this bug.
    if (!pulls.length) {
      debug('nothing to process');

      // Unsubscribe if necessary.
      var remainingPulls = yield bugzilla.getOpenPullsForBug(runtime, bug, function filter(bug, attachment) {
        return true;
      });

      if (!remainingPulls.length) {
        yield runtime.pulseApi.unsubscribe(runtime, bugId);
      }

      return;
    }

    // If the bug does not have checkin-needed, return
    if (bug.keywords.indexOf('checkin-needed')) {
      debug('Bug does not have checkin-needed.', bugId);
      return;
    }

    // Try to integrate the pull requests.
    for (var i = 0, iLen = pulls.length; i < iLen; i++) {
      var pull = pulls[i];
      yield github.integratePullRequest(runtime, bugId, pull);
    }
  };
};
