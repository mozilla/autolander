var bz = require('kg-bz');
var github = require('./github');
var debug = require('debug')('autolander:bugzilla');
var removeBranch = require('./github/remove_branch');
var thunkify = require('thunkify');
var validator = require('./github/validator');

/**
 * Returns true if the attachment on this bug can land.
 * Validates suggestedReviewer list.
 * If the user or flag requestee is not in the suggested reviewer list,
 * then do not allow the bug to land, and comment in the bug.
 * @param {Object} runtime
 * @param {Object} bug
 * @param {Object} attachment
 * @param {Object} pull The pull request object.
 */
exports.canLand = function * (runtime, bug, attachment, pull) {
  if (attachment.is_obsolete !== 0) {
    return false;
  }

  var getSuggestedReviewers = thunkify(runtime.bugzillaApi.getSuggestedReviewers.bind(runtime.bugzillaApi));
  var suggestedReviewers = yield getSuggestedReviewers(bug.id);
  var suggestedReviewersEmails = {};
  suggestedReviewers.forEach(function(reviewer) {
    suggestedReviewersEmails[reviewer.email] = true;
  });
  debug('got suggested reviewers', suggestedReviewers);

  var hasReview = false;
  var hasSuggestedReview = false;

  // Validate that the bug has a review flag.
  for (var i = 0, iLen = attachment.flags.length; i < iLen; i++) {
    var flag = attachment.flags[i];

    if (flag.status === '+' && flag.name === 'review') {
      hasReview = true;

      if (suggestedReviewersEmails[flag.setter] || suggestedReviewersEmails[flag.requestee]) {
        hasSuggestedReview = true;
      }
    }
  }
  debug('has R+, and is from suggested reviewer?', hasReview, hasSuggestedReview);

  // Validate that the pull request commits all have bug numbers. Return if they don't.
  if (hasReview) {
    var hasBugNumbers = yield validator.pullRequestCommitsHasBug(runtime, pull, bug);
    if (!hasBugNumbers) {
      return false;
    }
  }

  if (hasReview && hasSuggestedReview) {
    // This can return true if the patch has one R- and one R+. We generally accept this case as
    // adding the autoland keyword to a bug is quite a deliberate action, and if the user wanted to thye
    // could simply clear the R- and request autoland.
    // As long as the author has an R+ from a suggested reviewer, they are good.
    return true;
  } else if (hasReview && bug.keywords.indexOf('autoland') !== -1) {
    // Check if the review can land via a a review forwarded from a suggested reviewer.
    var hasForwardedReview = yield exports.hasForwardedReview(runtime, bug, attachment, suggestedReviewersEmails);
    if (hasForwardedReview) {
      return true;
    }

    // Else if we have a review and autoland, we leave a comment.
    yield exports.removeCheckinNeeded(runtime, bug.id);
    var comment = {
      comment: github.COMMENTS.NOT_SUGGESTED_REVIEWER
    };
    var addComment = thunkify(runtime.bugzillaApi.addComment.bind(runtime.bugzillaApi));
    yield addComment(bug.id, comment);

    return false;
  }
}

/**
 * Returns true if the attachment has a R+ from a user who was not a suggested reviewer,
 * but only if it was forwarded by a suggested reviewer.
 * @param {Object} runtime
 * @param {Object} bug
 * @param {Object} attachment
 * @param {Object} suggestedReviewerMap
 */
exports.hasForwardedReview = function * (runtime, bug, attachment, suggestedReviewerMap) {
  // Check each R+ attachment to see if it was originally requested by a suggested reviewer.
  for (var i = 0, iLen = attachment.flags.length; i < iLen; i++) {
    var flag = attachment.flags[i];

    if (flag.status === '+' && flag.name === 'review') {
      var flagActivity = thunkify(runtime.bugzillaApi.flagActivity.bind(runtime.bugzillaApi));
      var activity = yield flagActivity(flag.id);

      for (var j = 0, jLen = activity.length; j < jLen; j++) {
        var record = activity[j];

        if (record.status === '?' && suggestedReviewerMap[record.setter.name]) {
          return true;
        }
      }
    }
  }
  return false;
};

/**
 * Initializes the bugzilla API.
 */
exports.init = function * (config) {
  config.bugzillaConfig.timeout = 30000;
  return bz.createClient(config.bugzillaConfig || {});
};

/**
 * Attaches a pull request to a bugzilla bug if needed.
 * @param {Object} runtime
 * @param {Integer} bugId
 * @param {Object} pull The github pull request.
 */
exports.attachPullRequest = function * (runtime, bugId, pull) {
  debug('attaching pull request', bugId, pull.html_url);
  var prUrl = new Buffer(pull.html_url).toString('base64');

  var bugAttachments = thunkify(runtime.bugzillaApi.bugAttachments.bind(runtime.bugzillaApi));
  var list = yield bugAttachments(bugId);
  for (var i = 0, iLen = list.length; i < iLen; i++) {
    var attachment = list[i];
    if (attachment.data === prUrl && !attachment.is_obsolete) {
      // If the attachment already exists, simply subscribe to the bug.
      debug('attachment already exists');
      yield runtime.pulseApi.subscribe(runtime, bugId);
      return;
    }
  }

  var bugComment = 'A pull request has been submitted.';

  var attachment = {
    bug_id: bugId,
    comments: [{
      text: bugComment
    }],
    encoding: 'base64',
    data: prUrl.toString('base64'),

    // Create a summary like: [gaia] KevinGrandon:my_whatever_branch > mozilla-b2g:master
    summary: '[' + pull.base.repo.name + '] ' + pull.head.label + ' > ' + pull.base.label,

    file_name: 'Github pull request #' + pull.number,
    content_type: 'text/x-github-pull-request'
  };

  var createAttachment = thunkify(runtime.bugzillaApi.createAttachment.bind(runtime.bugzillaApi));
  var attachment = yield createAttachment(bugId, attachment);
  debug('created attachment', attachment);
};

/**
 * Gets pull requests for a bug that pass a filter.
 * @param {Object} runtime
 * @param {Object} bug The bug object from bz.js.
 */
exports.getOpenPullsForBug = function * (runtime, bug, filter) {
  var openPulls = [];

  var bugAttachments = thunkify(runtime.bugzillaApi.bugAttachments.bind(runtime.bugzillaApi));
  var attachments = yield bugAttachments(bug.id);

  for (var i = 0, iLen = attachments.length; i < iLen; i++) {
    var attachment = attachments[i];

    // Prevent unnecessary API calls for obsolete attachments.
    // If the attachment is obsolete we don't need to process this.
    // TODO: File a bug against bz.js to support filtering during the API call.
    if (attachment.is_obsolete) { continue; }

    // Check the pull request object and make sure that it's not yet merged.
    try {
      var prUrl = new Buffer(attachment.data, 'base64');
      var urlParts = String(prUrl).match(/github.com\/(.*)\/(.*)\/pull\/(.*)$/);

      var getRequest = thunkify(runtime.githubApi.pullRequests.get.bind(runtime.githubApi.pullRequests));
      var pr = yield getRequest({
        user: urlParts[1],
        repo: urlParts[2],
        number: urlParts[3],
        token: runtime.config.githubConfig.token
      });
    } catch(e) {
      debug('could not load pull request');
      continue;
    }

    var passesFilter = yield filter(runtime, bug, attachment, pr);
    if (passesFilter) {
      if (pr.merged || pr.state === 'closed') {
        debug('Pull request is already merged or closed.');
        continue;
      }
      openPulls.push(pr);
    }
  }
  return openPulls;
};

/**
 * Removes autoland from a bug.
 * @param {Object} runtime
 * @param {Integer} bugId
 */
exports.removeCheckinNeeded = function * (runtime, bugId) {
  var updateBug = thunkify(runtime.bugzillaApi.updateBug.bind(runtime.bugzillaApi));
  var updatedBugResp = yield updateBug(bugId, {
    keywords: {
      'remove': ['autoland']
    }
  });
  debug('Updated bug.', updatedBugResp);
};

/**
 * Comments on bugzilla about the merge.
 * @param {Object} runtime
 * @param {Integer} bugId
 * @param {String} branchName
 * @param {String} commitUrl
 */
exports.addLandingComment = function * (runtime, bugId, branchName, commitUrl) {
  var comment = {
    comment: 'Pull request has landed in ' + branchName + ': ' + commitUrl
  };
  var addComment = thunkify(runtime.bugzillaApi.addComment.bind(runtime.bugzillaApi));
  yield addComment(bugId, comment);
};

/**
 * Comments on bugzilla when CI failes.
 * @param {Object} runtime
 * @param {Integer} bugId
 * @param {String} comment
 */
exports.addCiFailedComment = function * (runtime, bugId, comment) {
  var github = require('./github');
  var comment = {
    comment: comment
  };
  var addComment = thunkify(runtime.bugzillaApi.addComment.bind(runtime.bugzillaApi));
  yield addComment(bugId, comment);
};

/**
 * Mark a bug as resolved fixed.
 * @param {Object} runtime
 * @param {Integer} bugId
 */
exports.resolveFix = function * (runtime, bugId) {
  var updateBug = thunkify(runtime.bugzillaApi.updateBug.bind(runtime.bugzillaApi));
  var updatedBugResp = yield updateBug(bugId, {
    status: 'RESOLVED',
    resolution: 'FIXED'
  });
  debug('updated bug status', updatedBugResp);
};

/**
 * Merges a pull request.
 * @param {Object} runtime
 * @param {Integer} bugId
 * @param {Object} pull The pull request object.
 * @param {String} baseBranch The base branch name.
 */
exports.mergePullRequest = function * (runtime, bugId, pull, baseBranch) {
  var repoParts = pull.base.repo.full_name.split('/');

  var mergeRequest = thunkify(runtime.githubApi.pullRequests.merge.bind(runtime.githubApi.pullRequests));
  var merge = yield mergeRequest({
    user: repoParts[0],
    repo: repoParts[1],
    number: pull.number,
    token: runtime.config.githubConfig.token
  });

  // TODO: Should comment on the github merge that we could not merge this.
  if (!merge.merged) {
    debug('Could not merge pull request.')
    return;
  }

  var commitUrl = 'https://github.com/' + pull.base.repo.full_name + '/commit/' + merge.sha;
  yield exports.addLandingComment(runtime, bugId, baseBranch, commitUrl);
  yield exports.removeCheckinNeeded(runtime, bugId);
  yield exports.resolveFix(runtime, bugId);
  yield removeBranch(runtime, repoParts[0], repoParts[1], 'integration-' + baseBranch);

  return merge;
};
