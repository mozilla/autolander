var thunkify = require('thunkify');

/**
 * Gets a github reference.
 * @param {Object} runtime
 * @param {String} user
 * @param {String} repo
 * @param {Number} branch
 */
module.exports = function * (runtime, user, repo, branch) {
  yield runtime.sleep();
  try {
    var getRef = thunkify(runtime.githubApi.gitdata.getReference.bind(runtime.githubApi.gitdata));
    return yield getRef({
      user: user,
      repo: repo,
      ref: 'heads/' + branch,
      token: runtime.config.githubConfig.token
    });
  } catch(e) {
    return null;
  }
};
