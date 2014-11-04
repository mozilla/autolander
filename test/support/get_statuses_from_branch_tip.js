var getReference = require('./get_reference');
var thunkify = require('thunkify');

/**
 * Gets the github statuses for a reference.
 * @param {Object} runtime
 * @param {String} user
 * @param {String} repo
 * @param {String} branch
 */
module.exports = function * (runtime, user, repo, branch) {
  yield runtime.sleep();
  try {
    var ref = yield getReference(runtime, user, repo, branch);

    var getStatus = thunkify(runtime.githubApi.statuses.get.bind(runtime.githubApi.statuses));
    return yield getStatus({
      user: user,
      repo: repo,
      sha: ref.object.sha,
      token: runtime.config.githubConfig.token
    });
  } catch(e) {
    return null;
  }
};
