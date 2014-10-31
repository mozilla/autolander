var thunkify = require('thunkify');

/**
 * Gets a pull request.
 * @param {Object} runtime
 * @param {String} head
 * @param {String} base
 * @param {Number} num
 */
module.exports = function * (runtime, user, repo, num) {
  yield runtime.sleep();
  var getPullRequest = thunkify(runtime.githubApi.pullRequests.get.bind(runtime.githubApi.pullRequests));
  return yield getPullRequest({
    user: user,
    repo: repo,
    number: num,
    token: runtime.config.githubConfig.token
  });
};
