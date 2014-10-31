var thunkify = require('thunkify');

/**
 * Creates a pull request.
 * @param {Object} runtime
 * @param {String} head
 * @param {String} base
 * @param {String} title
 */
module.exports = function * (runtime, head, base, title) {
  yield runtime.sleep();
  var create = thunkify(runtime.githubApi.pullRequests.create.bind(runtime.githubApi.pullRequests));
  return yield create({
    user: 'autolander',
    repo: 'autolander-test',
    title: title,
    base: base,
    head: head,
    token: runtime.config.githubConfig.token
  });
};
