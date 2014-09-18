var bz = require('bz');
var debug = require('debug')('autolander:bugzilla');
var thunkify = require('thunkify');

/**
 * Returns true if the attachment on this bug can land.
 */
function canLand(bug, attachment) {
  if (attachment.is_obsolete !== 0) {
    return false;
  }

  for (var i = 0, iLen = attachment.flags.length; i < iLen; i++) {
    var flag = attachment.flags[i];
    if (flag.status === '+' && flag.name === 'review') {
      return true;
    }
  }

  return false;
}

/**
 * Initializes the bugzilla API.
 */
exports.initApi = function *(config) {
  config.bugzillaConfig.timeout = 30000;
  return bz.createClient(config.bugzillaConfig || {});
};

/**
 * Attaches a pull request to a bugzilla bug if needed.
 * @param {Object} runtime
 * @param {Integer} bugId
 * @param {Object} event The github event.
 */
exports.attachPullRequest = function * (runtime, bugId, event) {
  var prUrl = new Buffer(event.pull_request.html_url).toString('base64');

  var bugAttachments = thunkify(runtime.bugzillaApi.bugAttachments.bind(runtime.bugzillaApi));
  var list = yield bugAttachments(bugId);
  for (var i = 0, iLen = list.length; i < iLen; i++) {
    var attachment = list[i];
    if (attachment.data === prUrl && !attachment.is_obsolete) {
      throw new Error('Attachment already exists.');
    }
  }

  var bugComment = 'A pull request has been submitted.';

  var attachment = {
    bug_id: bugId,
    comments: [{ text: bugComment }],
    encoding: 'base64',
    data: prUrl.toString('base64'),
    summary: event.pull_request.base.label + ' PR#' + event.pull_request.number,
    file_name: 'Github pull request #' + event.pull_request.number,
    content_type: 'text/x-github-pull-request'
  };

  var createAttachment = thunkify(runtime.bugzillaApi.createAttachment.bind(runtime.bugzillaApi));
  var attachment = yield createAttachment(bugId, attachment);
  debug('created attachment', attachment);
};

exports.processAttachments = function * (runtime, bugId) {
  var getBug = thunkify(runtime.bugzillaApi.getBug.bind(runtime.bugzillaApi));
  var bug = yield getBug(bugId);

  // If the bug does not have checkin-needed, return
  if (bug.keywords.indexOf('checkin-needed')) {
    debug('Bug does not have checkin-needed.', bugId);
    return;
  }

  var bugAttachments = thunkify(runtime.bugzillaApi.bugAttachments.bind(runtime.bugzillaApi));
  var attachments = yield bugAttachments(bugId);

  for (var i = 0, iLen = attachments.length; i < iLen; i++) {
    var attachment = attachments[i];
    if (canLand(bug, attachment)) {
      var prUrl = new Buffer(attachment.data, 'base64');
      var urlParts = String(prUrl).match(/github.com\/(.*)\/(.*)\/pull\/(.*)$/);

      // Check the pull request object and make sure that it's not yet merged.
      var getRequest = thunkify(runtime.githubApi.pullRequests.get.bind(runtime.githubApi.pullRequests));
      var pr = yield getRequest({
        user: urlParts[1],
        repo: urlParts[2],
        number: urlParts[3],
        token: runtime.config.githubConfig.token
      });

      if (pr.merged) {
        debug('Pull request is already merged.');
        continue;
      }

      var mergeRequest = thunkify(runtime.githubApi.pullRequests.merge.bind(runtime.githubApi.pullRequests));
      var merge = yield mergeRequest({
        user: urlParts[1],
        repo: urlParts[2],
        number: urlParts[3],
        token: runtime.config.githubConfig.token
      });

      // Comment on bugzilla with the merge.
      var mergeSha = merge.sha;
      var comment = {
        comment: 'Merged to master: ' + mergeSha
      };
      var addComment = thunkify(runtime.bugzillaApi.addComment.bind(runtime.bugzillaApi));
      yield addComment(bugId, comment);

      // Remove the checkin-needed keyword.
      var keywordIndex = bug.keywords.indexOf('checkin-needed');
      bug.keywords.splice(keywordIndex, 1);

      var updateBug = thunkify(runtime.bugzillaApi.updateBug.bind(runtime.bugzillaApi));
      var updatedBugResp = yield updateBug(bugId, {
        keywords: {
          'remove': ['checkin-needed']
        }
      });
      debug('Updated bug.', updatedBugResp);
    }
  }

  // Unsubscribe from the bug.
  yield runtime.pulseApi.isSubscribed(runtime, bugId);
};
