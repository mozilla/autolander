var thunkify = require('thunkify');

/**
 * Opens a pull request.
 * @param {Object} runtime
 * @param {Object} pull
 */
module.exports = function * (runtime, pull) {
  yield runtime.sleep();
  var openPullReq = thunkify(runtime.githubApi.pullRequests.update.bind(runtime.githubApi.pullRequests));
  return yield openPullReq({
    user: 'autolander',
    repo: 'autolander-test',
    title: pull.title,
    number: pull.number,
    state: 'open',
    token: runtime.config.githubConfig.token
  });
};
