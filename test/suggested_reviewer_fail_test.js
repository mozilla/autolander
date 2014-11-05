var assert = require('assert');
var co = require('co');
var helper = require('./helper');

var commitContent = require('./support/commit_content');
var createBug = require('./support/create_bug');
var createPullRequest = require('./support/create_pull_request');
var branchFromMaster = require('./support/branch_from_master');
var reviewAttachment = require('./support/review_attachment');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForSuggestedReviewerComment = require('./support/wait_for_suggested_reviewer_comment');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');

suite('without suggested reviewer > ', function() {

  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('does not land patch', co(function * () {
    // Create a bug in a component which our bot is not a suggested reviewer.
    // FirefoxOS::General currently meets those needs.
    var bug = yield createBug(runtime, null, 'General');

    yield commitContent(runtime, 'master', 'foo.txt', 'foo', 'Bug ' + bug.id + ' - add foo.txt');
    yield branchFromMaster(runtime, 'branch1');

    yield commitContent(runtime, 'branch1', 'foo.txt', 'bar', 'Bug ' + bug.id + ' - update foo.txt');
    var pull = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug.id + ' - integration test');

    var attachments = yield waitForAttachments(runtime, bug.id);
    yield reviewAttachment(runtime, attachments[0]);
    yield setCheckinNeeded(runtime, bug.id);

    // The empty tc case should pass immediately, and we should land and comment in the bug.
    var comments = yield waitForSuggestedReviewerComment(runtime, bug.id);
    yield waitForCheckinNeededRemoved(runtime, bug.id);
    assert.equal(comments.length, 3);
  }));
});
