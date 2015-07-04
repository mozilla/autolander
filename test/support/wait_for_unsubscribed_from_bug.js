var Promise = require('promise');
var thunkify = require('thunkify');
var debug = require('debug')('test:support:wait_for_unsubscribed_from_bug');

var WAIT_INTERVAL = 5000;
var MAX_TRIES = 100;

function sleep(n) {
  return new Promise(function(accept) {
    return setTimeout(accept, n);
  });
}

/**
 * Waits for us to be considered "unsubscribed".
 * Currently that means not tracking the bug in azure table storage.
 * @param {Object} runtime
 * @param {Number} bugId
 */
module.exports = function * (runtime, bugId) {
  var tries = 0;
  while (tries++ < MAX_TRIES) {
    debug('polling bug', bugId);
    var isSubscribed = yield runtime.bugStore.isSubscribed(bugId);

    if (!isSubscribed) {
      return true;
    }
    yield sleep(WAIT_INTERVAL);
  }
  throw new Error('Autoland not removed.');
};
