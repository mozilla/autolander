var thunkify = require('thunkify');

/**
 * Deletes the testing repository.
 * @param {Object} runtime
 * @param {String} user The github user for the repository.
 */
module.exports = function * (runtime, user) {
  yield runtime.sleep();
  var remove = thunkify(runtime.githubApi.repos.delete.bind(runtime.githubApi.repos));
  yield remove({
    user: user,
    repo: 'autolander-test',
    token: runtime.config.githubConfig.token
  });
};
