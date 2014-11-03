var Promise = require('promise');
var thunkify = require('thunkify');
var debug = require('debug')('test:support:wait_for_checkin_needed_removed');

var WAIT_INTERVAL = 5000;
var MAX_TRIES = 100;

function sleep(n) {
  return new Promise(function(accept) {
    return setTimeout(accept, n);
  });
}

/**
 * Waits for a bug to have the checkin-needed keyword removed.
 * @param {Object} runtime
 * @param {Number} bugId
 */
module.exports = function * (runtime, bugId) {
  var tries = 0;
  while (tries++ < MAX_TRIES) {
    debug('polling bug', bugId);
    var getBug = thunkify(runtime.bugzillaApi.getBug.bind(runtime.bugzillaApi));
    var bug = yield getBug(bugId);

    debug('keywords', bug.keywords);
    if (bug.keywords.indexOf('checkin-needed') === -1) {
      return true;
    }
    yield sleep(WAIT_INTERVAL);
  }
  throw new Error('Checkin-needed not removed.');
};
