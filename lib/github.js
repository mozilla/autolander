var bugzilla = require('./bugzilla');
var GitHubApi = require('github');
var thunkify = require('thunkify');
var debug = require('debug')('autolander:github');
var fetchContent = require('./github/fetch_content');
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
  NON_INTEGRABLE: 'The pull request could not be applied to the integration branch. Please try again after current integration is complete. You may need to rebase your branch against the target branch.',
  NON_COLLABORATOR: 'Autolander could not land the pull request due to not having collaborator rights. This is possibly due to a tree closure. Please check the tree status and request checkin again once the tree is open.',
  CI_FAILED: 'The pull request failed to pass integration tests. It could not be landed, please try again.',
  INVALID_COMMIT_NO_BUG: 'The pull request could not be integrated in as it contained a commit which was missing a bug number. Please ensure all commits contain bug numbers, and are in the format of: Bug [number] - [description]',
  NOT_SUGGESTED_REVIEWER: 'Autolander could not locate a review from a user within the suggested reviewer list. Either the patch author or the reviewer should be in the suggested reviewer list.',
  TASKGRAPH_POST_ERROR: 'There was an error creating the taskgraph, please try again. If the issue persists please contact someone in #taskcluster.',
  TREEHERDER_POST_ERROR: 'There was an error posting the resultset to treeherder, but we will still try to run your tests. If the issue persists please contact someone in #treeherder.'
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
  var repoParts = pull.base.repo.full_name.split('/');

  // Do not process this bug if we are currently integrating it.
  var isRunning = yield runtime.activeStore.isBugIntegrating(repoParts[0], repoParts[1], bugId);
  if (isRunning) {
    debug('bug is currently integrating', bugId);
    return;
  }

  // A reference to the merge to the integration branch.
  var integrationMerge;

  try {
    var merge = thunkify(runtime.githubApi.repos.merge.bind(runtime.githubApi.repos));
    integrationMerge = yield merge({
      user: repoParts[0],
      repo: repoParts[1],
      base: branchName,
      head: pull.head.sha,
      commit_message: 'Bug ' + bugId + ' - merge pull request #' + pull.number + ' from ' + pull.head.label + ' to ' + pull.base.label,
      token: runtime.config.githubConfig.token
    });
    debug('updated integration branch ref', branchName, pull.head.sha);
  } catch(e) {
    debug('could not fast-forward integration branch', bugId, pull.number, pull.head.sha, e);

    yield bugzilla.removeCheckinNeeded(runtime, bugId);

    // Check to see if the tree is closed. If the tree is closed leave a message notifying the user
    // to try again in the future. Otherwise leave a "non-integrable" message which may prompt the user to rebase.
    // We check the tree closure by checking if the "autolander" user is listed as a collaborator.
    // If we are not a collaborator, then it's likely that the user's group was removed, and the tree is closed.
    try {
      var getCollaborator = thunkify(runtime.githubApi.repos.getCollaborator.bind(runtime.githubApi.repos));
      yield getCollaborator({
        user: repoParts[0],
        repo: repoParts[1],
        collabuser: runtime.config.githubConfig.username
      });
    } catch(e) {
      var addComment = thunkify(runtime.bugzillaApi.addComment.bind(runtime.bugzillaApi));
      yield addComment(bugId, {
        comment: pull.html_url + '\n\n' + exports.COMMENTS.NON_COLLABORATOR
      });
      return;
    }

    yield exports.addComment(runtime, repoParts[0], repoParts[1], pull.number, exports.COMMENTS.NON_INTEGRABLE);

    var addComment = thunkify(runtime.bugzillaApi.addComment.bind(runtime.bugzillaApi));
    yield addComment(bugId, {
      comment: pull.html_url + '\n\n' + exports.COMMENTS.NON_INTEGRABLE
    });

    return;
  }

  // If there is *no* taskgraph in the base repository, we auto-land.
  var taskgraphContent;
  try {
    taskgraphContent = yield fetchContent(runtime, repoParts[0], repoParts[1], pull.base.ref, 'taskgraph.json');
  } catch(e) {
    // Error loading taskgraph content.
    taskgraphContent = false;
  }
  if (!taskgraphContent) {
    yield bugzilla.mergePullRequest(runtime, bugId, pull, pull.base.ref);
    return;
  }

  // Try scheduling the taskgraph.
  try {
    debug('creating taskgraph with integration merge commit', integrationMerge);
    yield taskgraph.create(runtime, bugId, pull, integrationMerge);

    // Now that we've submitted a taskgraph, remove autoland immediately.
    // We will still land whatever passes integration, but this is so that we don't
    // confuse the sheriffs.
    yield bugzilla.removeCheckinNeeded(runtime, bugId);
  } catch(e) {
    debug('could not create taskgraph', bugId, pull.number);
    debug(e, e.message);

    // Comment in the bug and remove autoland.
    yield bugzilla.removeCheckinNeeded(runtime, bugId);
    var comment = {
      comment: exports.COMMENTS.TASKGRAPH_POST_ERROR
    };
    var addComment = thunkify(runtime.bugzillaApi.addComment.bind(runtime.bugzillaApi));
    yield addComment(bugId, comment);
  }
};

/**
 * Creates the integration branch if needed.
 * @param {Object} runtime
 * @param {Object} pull
 */
exports.maybeCreateIntegrationBranch = function * (runtime, pull) {
  var branchName = 'integration-' + pull.base.ref;
  var repoParts = pull.base.repo.full_name.split('/');
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
    var baseBranchRef = yield getRef({
      user: repoParts[0],
      repo: repoParts[1],
      ref: 'heads/' + pull.base.ref,
      token: runtime.config.githubConfig.token
    });
    debug('got base branch ref', pull.base.ref, baseBranchRef.object.sha);

    try {
      var createRef = thunkify(runtime.githubApi.gitdata.createReference.bind(runtime.githubApi.gitdata));
      var ref = yield createRef({
        user: repoParts[0],
        repo: repoParts[1],
        ref: 'refs/heads/' + branchName,
        sha: baseBranchRef.object.sha,
        token: runtime.config.githubConfig.token
      });
      debug('created integration branch reference', ref.object.sha);
    } catch(e) {
      debug('integration branch already defined', branchName);
    }
  }
};
