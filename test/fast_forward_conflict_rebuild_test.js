var assert = require('assert');
var co = require('co');
var helper = require('./helper');
var fs = require('fs');
var jsTemplate = require('json-templater/object');
var slugid = require('slugid');

var commitContent = require('./support/commit_content');
var createBug = require('./support/create_bug');
var createPullRequest = require('./support/create_pull_request');
var branchFromMaster = require('./support/branch_from_master');
var getCommits = require('./support/get_commits');
var reviewAttachment = require('./support/review_attachment');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');
var waitForLandingComment = require('./support/wait_for_landing_comment');
var waitForPullState = require('./support/wait_for_pull_state');
var waitForResolvedFixed = require('./support/wait_for_resolved_fixed');

suite('fast forward conflict > ', function() {
  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('retries after fast-forward conflict', co(function * () {
    // Make a slow taskgraph which might not even finish before the test is done.
    // The result of this one does't really matter, we just care that the success
    // case and commenting is done in the case of a coalesce.
    var taskgraph = fs.readFileSync(__dirname + '/fixtures/tc_success/taskgraph.json', 'utf-8');
    taskgraph = jsTemplate(taskgraph, {
      taskId: slugid.v4()
    });

    yield commitContent(runtime, 'master', 'taskgraph.json', taskgraph);
    var bug1 = yield createBug(runtime);

    yield branchFromMaster(runtime, 'branch1');
    yield commitContent(runtime, 'branch1', 'foo.txt', 'foo', 'Bug ' + bug1.id + ' - add foo.txt');
    var pullSlow = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug1.id + ' - expecting a conflict on fast-forward');
    var attachments1 = yield waitForAttachments(runtime, bug1.id);
    yield reviewAttachment(runtime, attachments1[0]);
    yield setCheckinNeeded(runtime, bug1.id);

    // Wait until the pull request is in a pending state.
    // This way we know that we've already branched to the integration-master branch.
    // This is important so we know we don't have our later commit from master which we use to intentionally ruin the fast-forward.
    yield waitForPullState(runtime, 'autolander', 'autolander-test', 'branch1', 'pending');

    // Commit some content to master so it's no longer a fast-forward.
    yield commitContent(runtime, 'master', 'bar.txt', 'bar');

    // Make sure the retry landing looks good.
    yield waitForLandingComment(runtime, bug1.id);
    yield waitForCheckinNeededRemoved(runtime, bug1.id);
    yield waitForResolvedFixed(runtime, bug1.id);

    // The master branch should have four commits:
    // Two commits in master, and two from the branch including the merge to the integration branch.
    var commits = yield getCommits(runtime, 'autolander', 'autolander-test');
    assert.equal(commits.length, 4);
    assert.equal(commits[0].commit.message, 'Merge branch1 into integration-master');
  }));
});
