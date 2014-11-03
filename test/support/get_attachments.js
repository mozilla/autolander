var thunkify = require('thunkify');

/**
 * Get attachments for a bug.
 * @param {Object} runtime
 * @param {Number} bugId
 */
module.exports = function * (runtime, bugId) {
  var bugAttachments = thunkify(runtime.bugzillaApi.bugAttachments.bind(runtime.bugzillaApi));
  var list = yield bugAttachments(bugId);
  return list;
};
