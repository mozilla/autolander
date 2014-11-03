var thunkify = require('thunkify');

/**
 * Gives an attachment a R+ flag.
 * @param {Object} runtime
 * @param {Object} attachment
 */
module.exports = function * (runtime, attachment) {
  var updateAttachment = thunkify(runtime.bugzillaApi.updateAttachment.bind(runtime.bugzillaApi));
  var flag = yield updateAttachment(attachment.id, {
    flags: [{
      name: 'review',
      status: '+'
    }]
  });
  return flag;
};
