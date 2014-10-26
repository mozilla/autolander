var getAttachments = require('./get_attachments');
var Promise = require('promise');

var WAIT_INTERVAL = 2000;
var MAX_TRIES = 10;

function sleep(n) {
  return new Promise(function(accept) {
    return setTimeout(accept, n);
  });
}

/**
 * Get attachments for a bug.
 * @param {Object} runtime
 * @param {Number} bugId
 */
module.exports = function * (runtime, bugId) {
 var tries = 0;
  while (tries++ < MAX_TRIES) {
    var attachments = yield getAttachments(runtime, bugId);
    if (attachments.length) return attachments;
    yield sleep(WAIT_INTERVAL);
  }
  throw new Error('Cound not find attachment.');
};
