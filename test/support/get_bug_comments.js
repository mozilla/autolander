var thunkify = require('thunkify');

/**
 * Get comments for a bug.
 * @param {Object} runtime
 * @param {Number} bugId
 */
module.exports = function * (runtime, bugId) {
  var bugComments = thunkify(runtime.bugzillaApi.bugComments.bind(runtime.bugzillaApi));
  var list = yield bugComments(bugId);
  return list;
};
