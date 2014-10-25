var getAttachments = require('./get_attachments');
var Promise = require('promise');

var WAIT_INTERVAL = 500;
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
    sleep(WAIT_INTERVAL);
  }
};
