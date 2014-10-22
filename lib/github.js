var GitHubApi = require('github');
var thunkify = require('thunkify');
var debug = require('debug')('autolander:github');

/**
 * Initializes the github API.
 */
exports.init = function *(config) {
  var githubApi = new GitHubApi({
    version: '3.0.0',
    debug: true,
    protocol: 'https',
    host: config.host,
    //pathPrefix: '/api/v3',
    timeout: 5000
  });

  githubApi.authenticate({
    type: "oauth",
    token: config.githubConfig.token
  });

  return githubApi;
}

exports.COMMENTS = {
  NO_BUG_FOUND: 'Autolander could not find a bug number in your pull request title. All pull requests should be in the format of: Bug [number] - [description].'
};

/**
 * Comments on a pull request.
 * @param {Object} runtime
 * @param {Object} event
 * @param {String} comment
 */
exports.addComment = function *(runtime, event, comment) {
  var repoParts = event.pull_request.head.repo.full_name.split('/');

  var doComment = thunkify(runtime.githubApi.issues.createComment);
  yield doComment({
    body: comment,
    user: repoParts[0],
    repo: repoParts[1],
    number: event.number,
    token: runtime.config.githubConfig.token
  });
}

/**
 * Integrates a pull request into the integration branch.
 * @param {Object} runtime
 * @param {Object} pull
 */
exports.integratePullRequest = function * (runtime, pull) {
  yield exports.maybeCreateIntegrationBranch(runtime, pull);
};

/**
 * Creates the integration branch if needed.
 * @param {Object} runtime
 * @param {Object} pull
 */
exports.maybeCreateIntegrationBranch = function * (runtime, pull) {
  var branchName = 'integration-' + pull.base.ref;
  var repoParts = pull.head.repo.full_name.split('/');
  debug('creating integration branch', branchName);

  var existingBranch;
  var getBranch = thunkify(runtime.githubApi.repos.getBranch.bind(runtime.githubApi.repos));
  try {
    existingBranch = yield getBranch({
      user: repoParts[0],
      repo: repoParts[1],
      branch: branchName,
      token: runtime.config.githubConfig.token
    });
  } catch(e) {
  }

console.log('Got existingBranch', existingBranch)

  if (existingBranch && existingBranch.length) {
    debug('found existing branch', branchName);
  } else {
    debug('creating integration branch', branchName);

    var getRef = thunkify(runtime.githubApi.gitdata.getReference.bind(runtime.githubApi.gitdata));
    var masterRef = yield getRef({
      user: repoParts[0],
      repo: repoParts[1],
      ref: 'heads/' + pull.base.ref,
      token: runtime.config.githubConfig.token
    });
    debug('got mater ref', masterRef);

    var createRef = thunkify(runtime.githubApi.gitdata.createReference.bind(runtime.githubApi.gitdata));
    var ref = yield createRef({
      user: repoParts[0],
      repo: repoParts[1],
      ref: 'refs/heads/' + branchName,
      sha: masterRef.object.sha,
      token: runtime.config.githubConfig.token
    });
    debug('created reference', ref);
  }
};
