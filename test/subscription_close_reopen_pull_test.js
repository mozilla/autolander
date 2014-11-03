var assert = require('assert');
var co = require('co');
var helper = require('./helper');

var closePullRequest = require('./support/close_pull_request');
var commitContent = require('./support/commit_content');
var createBug = require('./support/create_bug');
var createPullRequest = require('./support/create_pull_request');
var branchFromMaster = require('./support/branch_from_master');
var openPullRequest = require('./support/open_pull_request');
var reviewAttachment = require('./support/review_attachment');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForLandingComment = require('./support/wait_for_landing_comment');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');
var waitForUnsubscribedFromBug = require('./support/wait_for_unsubscribed_from_bug');

var thunkify = require('thunkify');

suite('subscription > ', function() {

  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('can autoland after close/re-open', co(function * () {
    var bug = yield createBug(runtime);

    yield commitContent(runtime, 'master', 'foo.txt', 'foo');
    yield branchFromMaster(runtime, 'branch1');

    yield commitContent(runtime, 'branch1', 'foo.txt', 'bar');
    var pull = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug.id + ' - integration test');

    var attachments = yield waitForAttachments(runtime, bug.id);

    // Close the PR, and update in the bug. We should then be unsubscribed from it.
    yield closePullRequest(runtime, pull);

    var addComment = thunkify(runtime.bugzillaApi.addComment.bind(runtime.bugzillaApi));
    yield addComment(bug.id, {
      comment: 'See bug 1067619 - Review flags don\'t update pulse, but comments do.'
    });
    yield waitForUnsubscribedFromBug(runtime, bug.id);

    yield openPullRequest(runtime, pull);
    yield reviewAttachment(runtime, attachments[0]);
    yield setCheckinNeeded(runtime, bug.id);

    // The empty tc case should pass immediately, and we should land and comment in the bug.
    yield waitForLandingComment(runtime, bug.id);
    yield waitForCheckinNeededRemoved(runtime, bug.id);
    yield waitForUnsubscribedFromBug(runtime, bug.id);
  }));
});
