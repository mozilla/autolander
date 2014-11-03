var thunkify = require('thunkify');

/**
 * Sets checkin-needed on a bug.
 * @param {Object} runtime
 * @param {Number} bugId
 */
module.exports = function * (runtime, bugId) {
  var setKeyword = thunkify(runtime.bugzillaApi.updateBug.bind(runtime.bugzillaApi));
  return yield setKeyword(bugId, {
    keywords: {
      'add': ['checkin-needed']
    }
  });
};
