var thunkify = require('thunkify');

/**
 * Attaches a pull request to a bugzilla bug if needed.
 * @param {Object} runtime
 * @param {Integer} bugId
 * @param {Object} event The github event.
 */
exports.attachPullRequest = function *(runtime, bugId, event) {
  var prUrl = new Buffer(event.pull_request.html_url).toString('base64');

  var bugAttachments = thunkify(runtime.bugzillaApi.bugAttachments.bind(runtime.bugzillaApi));
  var list = yield bugAttachments(bugId);
  for (var i = 0, iLen = list.length; i < iLen; i++) {
    var attachment = list[i];
    if (attachment.data === prUrl) {
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
  console.log("attachment is ", attachment)
};
