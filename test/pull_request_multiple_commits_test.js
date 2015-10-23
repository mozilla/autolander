var assert = require('assert');
var co = require('co');
var fs = require('fs');
var helper = require('./helper');
var jsTemplate = require('json-templater/object');
var slugid = require('slugid');
var thunkify = require('thunkify');

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

suite('multiple commits in a pull request > ', function() {
  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('comments with the merge commit', co(function * () {
    var taskgraph = fs.readFileSync(__dirname + '/fixtures/tc_success/taskgraph.json', 'utf-8');
    taskgraph = jsTemplate(taskgraph, {
      taskId: slugid.nice()
    });

    yield commitContent(runtime, 'master', 'temp', 'foo');

    var bug = yield createBug(runtime);
    var ref = yield branchFromRef(runtime, 'branch1');

    yield commitToBranch(runtime, 'branch1', 'tc_success/empty', 'Bug ' + bug.id + ' - commit 1');
    yield commitContent(runtime, 'branch1', 'tempfile', 'test content',  'Bug ' + bug.id + ' - commit 2');
    var pull = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug.id + ' - integration test');

    var attachments = yield waitForAttachments(runtime, bug.id);
    yield reviewAttachment(runtime, attachments[0]);
    yield setCheckinNeeded(runtime, bug.id);

    // The empty tc case should pass immediately, and we should land and comment in the bug.
    // Check for the merge commit in the bugzilla comments.
    var landingComment = yield waitForLandingComment(runtime, bug.id);
    landingComment = landingComment.pop();
    var commitSha = landingComment.text.match(/commit\/([0-9a-g]*)/)[1]

    var getCommit = thunkify(runtime.githubApi.gitdata.getCommit.bind(runtime.githubApi.gitdata));
    var commit = yield getCommit({
      user: 'autolander',
      repo: 'autolander-test',
      sha: commitSha,
      token: runtime.config.githubConfig.token
    });

    // A merge commit has two parents.
    assert.equal(commit.parents.length, 2);
  }));
});
