var thunkify = require('thunkify');

/**
 * Requests a review from a user.
 * @param {Object} runtime
 * @param {Object} attachment
 * @param {Object} requestee The user to request review from.
 */
module.exports = function * (runtime, attachment, requestee) {
  var updateAttachment = thunkify(runtime.bugzillaApi.updateAttachment.bind(runtime.bugzillaApi));
  var flag = yield updateAttachment(attachment.id, {
    flags: [{
      name: 'review',
      status: '?',
      requestee: requestee
    }]
  });
  return flag;
};
