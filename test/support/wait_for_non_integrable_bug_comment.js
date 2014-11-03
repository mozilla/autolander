var getBugComments = require('./get_bug_comments');
var Promise = require('promise');

var LOOK_FOR = require('./../../lib/github').COMMENTS.NON_INTEGRABLE;
var WAIT_INTERVAL = 5000;
var MAX_TRIES = 10;

function sleep(n) {
  return new Promise(function(accept) {
    return setTimeout(accept, n);
  });
}

/**
 * Waits for a landing comment in a bug.
 * @param {Object} runtime
 * @param {Number} bugId
 */
module.exports = function * (runtime, bugId) {
  var tries = 0;
  while (tries++ < MAX_TRIES) {
    var comments = yield getBugComments(runtime, bugId);
    if (comments.length) {
      for (var i = 0; i < comments.length; i++) {
        if (comments[i].text.indexOf(LOOK_FOR) !== -1) {
          return comments;
        }
      }
    }
    yield sleep(WAIT_INTERVAL);
  }
  throw new Error('Cound not find merge comment.');
};
