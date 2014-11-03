var debug = require('debug')('utils:github:remove_branch');
var thunkify = require('thunkify');

/**
 * Tries to remove the integration branch. There are a variety of times we will want to remove
 * the integration branch. One being after a unsuccessful integration, we will want to reset
 * the branch and replay pull requests on top of it. We will also want to delete it after a
 * successful integration. Autolander may not be the only bot landing things to master, so
 * if we delete the branch, we will re-create it for the next pull request that comes in.
 * @param {Object} runtime
 * @param {String} user
 * @param {String} repo
 * @param {String} branch
 */
module.exports = function * (runtime, user, repo, branch) {
  try {
    debug('trying to remove branch', user, repo, branch);
    var remove = thunkify(runtime.githubApi.gitdata.deleteReference.bind(runtime.githubApi.gitdata));
    yield remove({
      user: user,
      repo: repo,
      ref: 'heads/' + branch,
      token: runtime.config.githubConfig.token
    });
  } catch(e) {
    debug('error removing integration branch', e);
  }
};
