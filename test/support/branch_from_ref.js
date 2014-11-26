var thunkify = require('thunkify');

/**
 * Creates a new branch from the tip of an existing branch.
 * @param {Object} runtime
 * @param {String} name The new branch name.
 * @param {String} baseBranch=master The name of what we're branching from.
 */
module.exports = function * (runtime, name, baseBranch) {

  baseBranch = baseBranch || 'master';

  yield runtime.sleep();
  var getRef = thunkify(runtime.githubApi.gitdata.getReference.bind(runtime.githubApi.gitdata));
  var baseBranchRef = yield getRef({
    user: 'autolander',
    repo: 'autolander-test',
    ref: 'heads/' + baseBranch,
    token: runtime.config.githubConfig.token
  });

  yield runtime.sleep();
  var createRef = thunkify(runtime.githubApi.gitdata.createReference.bind(runtime.githubApi.gitdata));
  var ref = yield createRef({
    user: 'autolander',
    repo: 'autolander-test',
    ref: 'refs/heads/' + name,
    sha: baseBranchRef.object.sha,
    token: runtime.config.githubConfig.token
  });
};
