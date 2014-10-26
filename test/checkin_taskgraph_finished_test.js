var assert = require('assert');
var co = require('co');

var commitToBranch = require('./support/commit_to_branch');
var createBug = require('./support/create_bug');
var createPullRequest = require('./support/create_pull_request');
var branchFromMaster = require('./support/branch_from_master');
var reviewAttachment = require('./support/review_attachment');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForLandingComment = require('./support/wait_for_landing_comment');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');

suite('taskgraph finished', function() {

  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    var setup = require('./setup');
    return yield setup(runtime);
  }));

  suiteTeardown(co(function * () {
    var teardown = require('./teardown');
    return yield teardown(runtime);
  }));

  test('patch is autolanded', co(function * () {
    yield commitToBranch(runtime, 'master', 'tc_repo/taskgraph.json');
    var bug = yield createBug(runtime);
    var ref = yield branchFromMaster(runtime, 'branch1');

    yield commitToBranch(runtime, 'branch1', 'tc_repo/empty');
    var pull = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug.id + ' - integration test');

    var attachments = yield waitForAttachments(runtime, bug.id);
    yield reviewAttachment(runtime, attachments[0]);
    yield setCheckinNeeded(runtime, bug.id);

    // The empty tc case should pass immediately, and we should land and comment in the bug.
    yield waitForLandingComment(runtime, bug.id);
    yield waitForCheckinNeededRemoved(runtime, bug.id);
  }));
});
