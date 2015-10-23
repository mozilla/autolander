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
var branchFromRef = require('./support/branch_from_ref');
var reviewAttachment = require('./support/review_attachment');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForLandingComment = require('./support/wait_for_landing_comment');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');
var waitForPullComments = require('./support/wait_for_pull_comments');
var waitForResolvedFixed = require('./support/wait_for_resolved_fixed');

suite('treeherder timeout > ', function() {
  var runtime;

  suiteSetup(co(function * () {
    process.env['TREEHERDER_URL'] = 'http://localhost:1234/timeout/please';
    runtime = yield require('./support/runtime')();
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('patch is autolanded even if TH times out', co(function * () {
    var taskgraph = fs.readFileSync(__dirname + '/fixtures/tc_success/taskgraph.json', 'utf-8');
    taskgraph = jsTemplate(taskgraph, {
      taskId: slugid.nice()
    });

    yield commitContent(runtime, 'master', 'taskgraph.json', taskgraph);

    var bug = yield createBug(runtime);
    var ref = yield branchFromRef(runtime, 'branch1');

    yield commitToBranch(runtime, 'branch1', 'tc_success/empty', 'Bug ' + bug.id + ' - add file');
    var pull = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug.id + ' - integration test - treeherder timeout');

    var attachments = yield waitForAttachments(runtime, bug.id);
    yield reviewAttachment(runtime, attachments[0]);
    yield setCheckinNeeded(runtime, bug.id);

    // Wait for the bug to be fixed and landed.
    yield waitForLandingComment(runtime, bug.id);
    yield waitForCheckinNeededRemoved(runtime, bug.id);
    yield waitForResolvedFixed(runtime, bug.id);

    var comments = yield waitForPullComments(runtime, 'autolander', 'autolander-test', pull.number);
    var expected = require('./../lib/github').COMMENTS.TREEHERDER_POST_ERROR;
    assert.equal(comments[0].body, expected);

    // The master branch should have three commits:
    // One original commit, one from the branch, and one branch -> integration branch merge.
    var commits = yield getCommits(runtime, 'autolander', 'autolander-test');
    assert.equal(commits.length, 3);
    checkMergeCommit(commits[0].commit.message, 'branch1');
  }));
});
