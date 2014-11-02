var Promise = require('promise');
var thunkify = require('thunkify');
var debug = require('debug')('test:support:wait_for_resolved_fixed');

var WAIT_INTERVAL = 5000;
var MAX_TRIES = 100;

function sleep(n) {
  return new Promise(function(accept) {
    return setTimeout(accept, n);
  });
}

/**
 * Waits for a bug to be resolved and fixed.
 * @param {Object} runtime
 * @param {Number} bugId
 */
module.exports = function * (runtime, bugId) {
  var tries = 0;
  while (tries++ < MAX_TRIES) {
    debug('polling bug', bugId);
    var getBug = thunkify(runtime.bugzillaApi.getBug.bind(runtime.bugzillaApi));
    var bug = yield getBug(bugId);

    debug('status', bug.status);
    debug('resolution', bug.resolution);
    if (bug.status === 'RESOLVED' && bug.resolution === 'FIXED') {
      return true;
    }
    yield sleep(WAIT_INTERVAL);
  }
  throw new Error('But was not resolved fixed.');
};
