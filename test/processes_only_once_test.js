var assert = require('assert');
var co = require('co');
var helper = require('./helper');
var fs = require('fs');
var jsTemplate = require('json-templater/object');
var slugid = require('slugid');
var thunkify = require('thunkify');

var commitContent = require('./support/commit_content');
var createBug = require('./support/create_bug');
var createPullRequest = require('./support/create_pull_request');
var branchFromRef = require('./support/branch_from_ref');

var getBugComments = require('./support/get_bug_comments');
var getStatusesFromBranchTip = require('./support/get_statuses_from_branch_tip');
var reviewAttachment = require('./support/review_attachment');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');
var waitForLandingComment = require('./support/wait_for_landing_comment');
var waitForPullState = require('./support/wait_for_pull_state');
var waitForResolvedFixed = require('./support/wait_for_resolved_fixed');

suite('processing duplicate bug notifications > ', function() {
  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('does not create multiple taskgraphs', co(function * () {
    // Make a slow taskgraph, which will eventually pass.
    var taskgraphFirstSlow = fs.readFileSync(__dirname + '/fixtures/tc_success/taskgraph.json', 'utf-8');
    taskgraphFirstSlow = jsTemplate(taskgraphFirstSlow, {
      taskId: slugid.v4()
    });
    taskgraphFirstSlow = JSON.parse(taskgraphFirstSlow);
    taskgraphFirstSlow.tasks[0].task.payload.command[2] = "sleep 10s && echo \"Hello World\";"
    taskgraphFirstSlow = JSON.stringify(taskgraphFirstSlow);

    yield commitContent(runtime, 'master', 'taskgraph.json', taskgraphFirstSlow);
    var bug = yield createBug(runtime);

    yield branchFromRef(runtime, 'branch1');
    yield commitContent(runtime, 'branch1', 'foo.txt', 'foo', 'Bug ' + bug.id + ' - add foo.txt');
    var pullSlow = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug.id + ' - check that we only process once');
    var attachments1 = yield waitForAttachments(runtime, bug.id);
    yield reviewAttachment(runtime, attachments1[0]);
    yield setCheckinNeeded(runtime, bug.id);

    // Wait until the pull request is in a pending state.
    // This way we know that we've already branched to the integration-master branch.
    // This is important so we know we don't have our later commit from master which we use to intentionally ruin the fast-forward.
    yield waitForPullState(runtime, 'autolander', 'autolander-test', 'branch1', 'pending');

    // Add a comment to the bug to see if it's going to cause us to process it twice.
    var addComment = thunkify(runtime.bugzillaApi.addComment.bind(runtime.bugzillaApi));
    yield addComment(bug.id, {
      comment: 'here is a test comment.'
    });

    // Make sure the retry landing looks good.
    yield waitForLandingComment(runtime, bug.id);
    yield waitForCheckinNeededRemoved(runtime, bug.id);
    yield waitForResolvedFixed(runtime, bug.id);

    // We should have two statuses on the pull request.
    var statuses = yield getStatusesFromBranchTip(runtime, 'autolander', 'autolander-test', 'branch1');
    assert.equal(statuses.length, 2);
    assert.equal(statuses[0].state, 'success');
    assert.equal(statuses[1].state, 'pending');

    // The bug should have four comments:
    // The description, attachment, test comment, and landing comment.
    var comments = yield getBugComments(runtime, bug.id);
    assert.equal(comments.length, 4);
  }));
});
