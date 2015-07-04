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
    var pulls = yield bugzilla.getOpenPullsForBug(runtime, bug, bugzilla.canLand);

    // Unsubscribe if there are no open pulls for this bug.
    if (!pulls.length) {
      debug('nothing to process');

      // Unsubscribe if necessary.
      var remainingPulls = yield bugzilla.getOpenPullsForBug(runtime, bug, function * (runtime, bug, attachment) {
        return true;
      });

      if (!remainingPulls.length) {
        yield runtime.pulseApi.unsubscribe(runtime, bugId);
      }

      return;
    }

    // If the bug does not have autoland, return
    if (bug.keywords.indexOf('autoland') === -1) {
      debug('Bug does not have the autoland keyword.', bugId);
      return;
    }

    // If we are monitoring this bug and it's got autoland, but in an un-supported product,
    // do not allow auto-landing.  This is a temporary validation while we audit and re-define
    // the process for becoming a suggested reviewer.
    // Once bug 1094926 is fixed, we can remove this validation.
    debug('bug is:', bug);
    var supportedProducts = runtime.config.bugzillaSupportedProducts.split(',');
    if (supportedProducts.indexOf(bug.product) === -1) {
      debug('Bug is not in a supported product', bug.product);
      return;
    }

    // Try to integrate the pull requests.
    for (var i = 0, iLen = pulls.length; i < iLen; i++) {
      var pull = pulls[i];
      yield github.integratePullRequest(runtime, bugId, pull);
    }
  };
};
