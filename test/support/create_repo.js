var thunkify = require('thunkify');

/**
 * Creates the testing repository.
 * @param {Object} runtime
 * @param {String} user The github user for the repository.
 */
module.exports = function * (runtime, user) {
  yield runtime.sleep();
  var create = thunkify(runtime.githubApi.repos.create.bind(runtime.githubApi.repos));
  yield create({
    user: user,
    name: 'autolander-test',
    token: runtime.config.githubConfig.token
  });
};
