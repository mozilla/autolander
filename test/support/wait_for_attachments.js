var getAttachments = require('./get_attachments');
var Promise = require('promise');

var WAIT_INTERVAL = 5000;
var MAX_TRIES = 100;

function sleep(n) {
  return new Promise(function(accept) {
    return setTimeout(accept, n);
  });
}

/**
 * Get attachments for a bug.
 * @param {Object} runtime
 * @param {Number} bugId
 * @param {Number} minNum=1 The minimum number of attachments we're waiting for.
 */
module.exports = function * (runtime, bugId, minNum) {
  minNum = minNum || 1;
  var tries = 0;
  while (tries++ < MAX_TRIES) {
    var attachments = yield getAttachments(runtime, bugId);
    if (attachments.length >= minNum) return attachments;
    yield sleep(WAIT_INTERVAL);
  }
  throw new Error('Cound not find attachment.');
};
