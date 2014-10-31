var thunkify = require('thunkify');

/**
 * Closes a pull request.
 * @param {Object} runtime
 * @param {Object} pull
 */
module.exports = function * (runtime, pull) {
  yield runtime.sleep();
  var closePullReq = thunkify(runtime.githubApi.pullRequests.update.bind(runtime.githubApi.pullRequests));
  return yield closePullReq({
    user: 'autolander',
    repo: 'autolander-test',
    title: pull.title,
    number: pull.number,
    state: 'closed',
    token: runtime.config.githubConfig.token
  });
};
