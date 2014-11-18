var getBugComments = require('./get_bug_comments');
var Promise = require('promise');

var LOOK_FOR = 'Pull request has landed in master';
var WAIT_INTERVAL = 5000;
var MAX_TRIES = 100;

function sleep(n) {
  return new Promise(function(accept) {
    return setTimeout(accept, n);
  });
}

/**
 * Waits for a landing comment in a bug.
 * @param {Object} runtime
 * @param {Number} bugId
 * @param {Number} num The number of landing comments to look for.
 */
module.exports = function * (runtime, bugId, num) {
  var tries = 0;
  num = num || 1;
  while (tries++ < MAX_TRIES) {
    var comments = yield getBugComments(runtime, bugId);
    if (comments.length) {
      var found = 0;
      for (var i = 0; i < comments.length; i++) {
        if (comments[i].text.indexOf(LOOK_FOR) !== -1) {
          found++;
        }
        if (found >= num) {
          return comments;
        }
      }
    }
    yield sleep(WAIT_INTERVAL);
  }
  throw new Error('Cound not find merge comment.');
};
