var getBugComments = require('./get_bug_comments');
var debug = require('debug')('test:support:wait_for_suggested_reviewer_comment');
var Promise = require('promise');

var LOOK_FOR = require('./../../lib/github').COMMENTS.NOT_SUGGESTED_REVIEWER;
var WAIT_INTERVAL = 5000;
var MAX_TRIES = 100;

function sleep(n) {
  return new Promise(function(accept) {
    return setTimeout(accept, n);
  });
}

/**
 * Waits for the missing suggested reviewer comment in the bug.
 * @param {Object} runtime
 * @param {Number} bugId
 */
module.exports = function * (runtime, bugId) {
  var tries = 0;
  while (tries++ < MAX_TRIES) {
    debug('polling bug', bugId);
    var comments = yield getBugComments(runtime, bugId);
    if (comments.length) {
      for (var i = 0; i < comments.length; i++) {
        debug('comments', comments);
        if (comments[i].text.indexOf(LOOK_FOR) !== -1) {
          return comments;
        }
      }
    }
    yield sleep(WAIT_INTERVAL);
  }
  throw new Error('Cound not find suggested reviewer comment.');
};
