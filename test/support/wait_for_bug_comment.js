var getBugComments = require('./get_bug_comments');
var Promise = require('promise');

var WAIT_INTERVAL = 5000;
var MAX_TRIES = 10;

function sleep(n) {
  return new Promise(function(accept) {
    return setTimeout(accept, n);
  });
}

/**
 * Waits for a specific comment in a bug.
 * @param {Object} runtime
 * @param {Number} bugId
 * @param {String} lookFor The comment to look for.
 */
module.exports = function * (runtime, bugId, lookFor) {
  var tries = 0;
  while (tries++ < MAX_TRIES) {
    var comments = yield getBugComments(runtime, bugId);
    if (comments.length) {
      for (var i = 0; i < comments.length; i++) {
        if (comments[i].text.indexOf(lookFor) !== -1) {
          return comments;
        }
      }
    }
    yield sleep(WAIT_INTERVAL);
  }
  throw new Error('Cound not find comment.');
};
