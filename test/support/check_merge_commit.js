var assert = require('assert');

/**
 * Checks that the merge commit meets the expected format.
 * @param {String} message The merge commit message.
 * @param {String} headBranch The HEAD branch.
 */
module.exports = function(message, headBranch) {
  var regexp = new RegExp("^Bug\\s+.*-\\s+merge\\s+pull\\s+request\\s+#[0-9]+\\s+from\\s+autolander:" + headBranch + ".*");
  assert.ok(regexp.test(message));
}
