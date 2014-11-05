var assert = require('assert');
var co = require('co');
var fs = require('fs');
var helper = require('./helper');
var jsTemplate = require('json-templater/object');
var slugid = require('slugid');

var checkMergeCommit = require('./support/check_merge_commit');
var commitContent = require('./support/commit_content');
var commitToBranch = require('./support/commit_to_branch');
var createBug = require('./support/create_bug');
var createPullRequest = require('./support/create_pull_request');
var getCommits = require('./support/get_commits');
var getReference = require('./support/get_reference');
var getStatusesFromBranchTip = require('./support/get_statuses_from_branch_tip');
var branchFromMaster = require('./support/branch_from_master');
var reviewAttachment = require('./support/review_attachment');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForLandingComment = require('./support/wait_for_landing_comment');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');
var waitForResolvedFixed = require('./support/wait_for_resolved_fixed');
var waitForUnsubscribedFromBug = require('./support/wait_for_unsubscribed_from_bug');

suite('taskgraph success > ', function() {
  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('patch is autolanded', co(function * () {
    var taskgraph = fs.readFileSync(__dirname + '/fixtures/tc_success/taskgraph.json', 'utf-8');
    taskgraph = jsTemplate(taskgraph, {
      taskId: slugid.v4()
    });

    yield commitContent(runtime, 'master', 'taskgraph.json', taskgraph);

    var bug = yield createBug(runtime);
    var ref = yield branchFromMaster(runtime, 'branch1');

    yield commitToBranch(runtime, 'branch1', 'tc_success/empty', 'Bug ' + bug.id + ' - add file');
    var pull = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug.id + ' - integration test');

    var attachments = yield waitForAttachments(runtime, bug.id);
    yield reviewAttachment(runtime, attachments[0]);
    yield setCheckinNeeded(runtime, bug.id);

    // The empty tc case should pass immediately, and we should land and comment in the bug.
    yield waitForLandingComment(runtime, bug.id);
    yield waitForCheckinNeededRemoved(runtime, bug.id);
    yield waitForResolvedFixed(runtime, bug.id);

    yield waitForUnsubscribedFromBug(runtime, bug.id);

    // We should have two statuses on the pull request.
    var statuses = yield getStatusesFromBranchTip(runtime, 'autolander', 'autolander-test', 'branch1');
    assert.equal(statuses.length, 2);
    assert.equal(statuses[0].state, 'success');
    assert.equal(statuses[1].state, 'pending');

    // The integration branch should go away after a successful integration.
    var integrationBranch = yield getReference(runtime, 'autolander', 'autolander-test', 'integration-master');
    assert.equal(integrationBranch, null);

    // The master branch should have three commits:
    // One original commit, one from the branch, and one branch -> integration branch merge.
    // Eventually we would like to fast-forward the integration branch, so this would only be 2 commits.
    var commits = yield getCommits(runtime, 'autolander', 'autolander-test');
    assert.equal(commits.length, 3);
    checkMergeCommit(commits[0].commit.message, 'branch1');
  }));
});
