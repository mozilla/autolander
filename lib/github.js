var bugzilla = require('./bugzilla');
var GitHubApi = require('github');
var thunkify = require('thunkify');
var debug = require('debug')('autolander:github');
var taskgraph = require('./taskgraph');

/**
 * Initializes the github API.
 */
exports.init = function * (config) {
  var githubApi = new GitHubApi({
    version: '3.0.0',
    debug: false,
    protocol: 'https',
    host: config.host,
    timeout: 5000
  });

  githubApi.authenticate({
    type: "oauth",
    token: config.githubConfig.token
  });

  return githubApi;
}

exports.COMMENTS = {
  NO_BUG_FOUND: 'Autolander could not find a bug number in your pull request title. All pull requests should be in the format of: Bug [number] - [description].',
  NON_INTEGRABLE: 'The pull request could not be applied to the integration branch. Please try again after current integration is complete.',
  CI_FAILED: 'The pull request failed to pass integration tests. It could not be landed in master, please try again.',
  NOT_SUGGESTED_REVIEWER: 'Autolander could not locate a review from a user within the suggested reviewer list. Either the patch author or the reviewer should be in the suggested reviewer list.'
};

/**
 * Comments on a pull request.
 * @param {Object} runtime
 * @param {String} user
 * @param {String} repo
 * @param {String} comment
 * @param {Number} number
 */
exports.addComment = function * (runtime, user, repo, number, comment) {
  var doComment = thunkify(runtime.githubApi.issues.createComment);
  yield doComment({
    body: comment,
    user: user,
    repo: repo,
    number: number,
    token: runtime.config.githubConfig.token
  });
}

/**
 * Integrates a pull request into the integration branch.
 * @param {Object} runtime
 * @param {Number} bugId
 * @param {Object} pull
 */
exports.integratePullRequest = function * (runtime, bugId, pull) {
  yield exports.maybeCreateIntegrationBranch(runtime, pull);

  var branchName = 'integration-' + pull.base.ref;
  var repoParts = pull.head.repo.full_name.split('/');

  try {
    var merge = thunkify(runtime.githubApi.repos.merge.bind(runtime.githubApi.repos));
    var merged = yield merge({
      user: repoParts[0],
      repo: repoParts[1],
      base: branchName,
      head: pull.head.ref,
      token: runtime.config.githubConfig.token
    });
    debug('updated integration branch ref', branchName, pull.head.sha);
  } catch(e) {
    debug('could not fast-forward integration branch', bugId, pull.number, pull.head.sha, e);
    yield exports.addComment(runtime, repoParts[0], repoParts[1], pull.number, exports.COMMENTS.NON_INTEGRABLE);

    var addComment = thunkify(runtime.bugzillaApi.addComment.bind(runtime.bugzillaApi));
    yield addComment(bugId, {
      comment: pull.html_url + '\n\n' + exports.COMMENTS.NON_INTEGRABLE
    });

    yield bugzilla.removeCheckinNeeded(runtime, bugId);
    return;
  }

  try {
    // Now schedule a taskgraph.
    debug('creating taskgraph');
    yield taskgraph.create(runtime, bugId, pull);
  } catch(e) {
    debug('could not create taskgraph', bugId, pull.number);
    debug(e, e.message);

    // Repos without a taskgraph.json skip the integration step and can land directly in master.
    yield bugzilla.mergePullRequest(runtime, bugId, pull, pull.base.ref);
  }
};

/**
 * Creates the integration branch if needed.
 * @param {Object} runtime
 * @param {Object} pull
 */
exports.maybeCreateIntegrationBranch = function * (runtime, pull) {
  var branchName = 'integration-' + pull.base.ref;
  var repoParts = pull.head.repo.full_name.split('/');
  debug('trying to create integration branch', branchName);

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

  if (existingBranch) {
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
    debug('got master ref', masterRef.object.sha);

    try {
      var createRef = thunkify(runtime.githubApi.gitdata.createReference.bind(runtime.githubApi.gitdata));
      var ref = yield createRef({
        user: repoParts[0],
        repo: repoParts[1],
        ref: 'refs/heads/' + branchName,
        sha: masterRef.object.sha,
        token: runtime.config.githubConfig.token
      });
      debug('created integration branch reference', ref.object.sha);
    } catch(e) {
      debug('integration branch already defined', branchName);
    }
  }
};
