var thunkify = require('thunkify');

/**
 * Gets comments for a pull request.
 * @param {Object} runtime
 * @param {String} head
 * @param {String} base
 * @param {Number} num
 */
module.exports = function * (runtime, user, repo, num) {
  yield runtime.sleep();
  var getComments = thunkify(runtime.githubApi.issues.getComments.bind(runtime.githubApi.issues));
  return yield getComments({
    user: user,
    repo: repo,
    number: num,
    token: runtime.config.githubConfig.token
  });
};
