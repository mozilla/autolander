var thunkify = require('thunkify');

/**
 * Gets commits for a branch.
 * @param {Object} runtime
 * @param {String} user
 * @param {String} repo
 */
module.exports = function * (runtime, user, repo) {
  yield runtime.sleep();
  var getCommits = thunkify(runtime.githubApi.repos.getCommits.bind(runtime.githubApi.repos));
  return yield getCommits({
    user: user,
    repo: repo,
    token: runtime.config.githubConfig.token
  });
};
