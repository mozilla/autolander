var thunkify = require('thunkify');

exports.COMMENTS = {
  NO_BUG_FOUND: 'Autolander could not find a bug number in your pull request title. All pull requests should be in the format of: Bug [number] - [description].'
};

/**
 * Comments on a pull request.
 * @param {Object} runtime
 * @param {Object} event
 * @param {String} comment
 */
exports.addComment = function *(runtime, event, comment) {
  var doComment = thunkify(runtime.githubApi.issues.createComment);
  yield doComment({
    body: comment,
    user: 'KevinGrandon',
    repo: 'gaia',
    number: event.number,
    token: runtime.config.token
  });
}
