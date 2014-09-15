var bugzilla = require('../lib/bugzilla');
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

    console.log('Got pulse bug update for:', bugId);
    yield bugzilla.processAttachments(runtime, bugId);
  };
};
