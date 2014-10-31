var thunkify = require('thunkify');

/**
 * Creates a new branch from the tip of master.
 * @param {Object} runtime
 * @param {String} name The branch name.
 */
module.exports = function * (runtime, name) {

  yield runtime.sleep();
  var getRef = thunkify(runtime.githubApi.gitdata.getReference.bind(runtime.githubApi.gitdata));
  var masterRef = yield getRef({
    user: 'autolander',
    repo: 'autolander-test',
    ref: 'heads/master',
    token: runtime.config.githubConfig.token
  });

  yield runtime.sleep();
  var createRef = thunkify(runtime.githubApi.gitdata.createReference.bind(runtime.githubApi.gitdata));
  var ref = yield createRef({
    user: 'autolander',
    repo: 'autolander-test',
    ref: 'refs/heads/' + name,
    sha: masterRef.object.sha,
    token: runtime.config.githubConfig.token
  });
};
