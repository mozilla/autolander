var assert = require('assert');
var co = require('co');
var helper = require('./helper');
var fs = require('fs');
var jsTemplate = require('json-templater/object');
var slugid = require('slugid');

var commitContent = require('./support/commit_content');
var commitToBranch = require('./support/commit_to_branch');
var createBug = require('./support/create_bug');
var createPullRequest = require('./support/create_pull_request');
var branchFromMaster = require('./support/branch_from_master');
var getPullRequest = require('./support/get_pull_request');
var getStatusesFromBranchTip = require('./support/get_statuses_from_branch_tip');
var reviewAttachment = require('./support/review_attachment');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForFailedCommentInBug = require('./support/wait_for_failed_comment_in_bug');
var waitForLandingComment = require('./support/wait_for_landing_comment');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');
var waitForPullComments = require('./support/wait_for_pull_comments');

suite('taskgraph failure > ', function() {
  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('successful patch lands after a failure', co(function * () {
    var taskgraphFailure = fs.readFileSync(__dirname + '/fixtures/tc_failure/taskgraph.json', 'utf-8');
    taskgraphFailure = jsTemplate(taskgraphFailure, {
      taskId: slugid.v4()
    });

    var taskgraphSuccess = fs.readFileSync(__dirname + '/fixtures/tc_success/taskgraph.json', 'utf-8');
    taskgraphSuccess = jsTemplate(taskgraphSuccess, {
      taskId: slugid.v4()
    });

    yield commitContent(runtime, 'master', 'taskgraph.json', taskgraphFailure);
    var bug1 = yield createBug(runtime);
    var bug2 = yield createBug(runtime);

    yield branchFromMaster(runtime, 'branch1');
    yield commitContent(runtime, 'branch1', 'foo.txt', 'bar');

    // Submit the pull request which will fail.
    var pull1 = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug1.id + ' - Autolander test failed taskgraph');

    var attachments = yield waitForAttachments(runtime, bug1.id);
    yield reviewAttachment(runtime, attachments[0]);
    yield setCheckinNeeded(runtime, bug1.id);

    // Submit a new pull request, which should be merged.
    // We change the taskgraph in the branch to be the success case.
    yield branchFromMaster(runtime, 'branch2');
    yield commitContent(runtime, 'branch2', 'taskgraph.json', taskgraphSuccess);

    var pull2 = yield createPullRequest(runtime, 'branch2', 'master', 'Bug ' + bug2.id + ' - Autolander success taskgraph');
    var attachments = yield waitForAttachments(runtime, bug2.id);
    yield reviewAttachment(runtime, attachments[0]);
    yield setCheckinNeeded(runtime, bug2.id);

    // The empty tc case should pass immediately, and we should land and comment in the bug.
    yield waitForCheckinNeededRemoved(runtime, bug1.id);
    yield waitForFailedCommentInBug(runtime, bug1.id);

    // The first pull request should not be merged.
    pull1 = yield getPullRequest(runtime, 'autolander', 'autolander-test', pull1.number);
    assert.equal(pull1.merged, false);
    var comments = yield waitForPullComments(runtime, 'autolander', 'autolander-test', pull1.number);
    var expected = require('./../lib/github').COMMENTS.CI_FAILED;
    assert.ok(comments[0].body.indexOf(expected) !== -1);

    // The second pull request should be merged eventually.
    yield waitForLandingComment(runtime, bug2.id);

    // The first pull request should have some statuses.
    var statuses = yield getStatusesFromBranchTip(runtime, 'autolander', 'autolander-test', 'branch1');
    assert.equal(statuses.length, 2);
    assert.equal(statuses[0].state, 'failure');
    assert.equal(statuses[1].state, 'pending');
  }));
});
