var getPullComments = require('./get_pull_comments');
var Promise = require('promise');

var WAIT_INTERVAL = 500;
var MAX_TRIES = 10;

function sleep(n) {
  return new Promise(function(accept) {
    return setTimeout(accept, n);
  });
}

/**
 * Waits for comments to be present on a pull request.
 * @param {Object} runtime
 * @param {String} head
 * @param {String} base
 * @param {Number} num
 * @param {Number} minRequred=1 Waits for this many comments.
 */
module.exports = function * (runtime, user, repo, num, minRequred) {
  var tries = 0;
  minRequred = minRequred || 1;
  while (tries++ < MAX_TRIES) {
    var comments = yield getPullComments(runtime, user, repo, num);
    if (comments.length >= minRequred) return comments;
    sleep(WAIT_INTERVAL);
  }
};
