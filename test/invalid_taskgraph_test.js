var assert = require('assert');
var co = require('co');
var fs = require('fs');
var helper = require('./helper');
var jsTemplate = require('json-templater/object');
var slugid = require('slugid');

var branchFromRef = require('./support/branch_from_ref');
var commitContent = require('./support/commit_content');
var commitToBranch = require('./support/commit_to_branch');
var createBug = require('./support/create_bug');
var createPullRequest = require('./support/create_pull_request');
var getPullRequest = require('./support/get_pull_request');
var reviewAttachment = require('./support/review_attachment');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForBugComment = require('./support/wait_for_bug_comment');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');

suite('invalid taskgraph > ', function() {
  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('comments on PR and removes autoland', co(function * () {
    var taskgraph = fs.readFileSync(__dirname + '/fixtures/tc_success/taskgraph.json', 'utf-8');
    taskgraph = jsTemplate(taskgraph, {
      taskId: slugid.v4()
    }) + ' - Make this taskgraph invalid.';

    yield commitContent(runtime, 'master', 'taskgraph.json', taskgraph);

    var bug = yield createBug(runtime);
    var ref = yield branchFromRef(runtime, 'branch1');

    yield commitToBranch(runtime, 'branch1', 'tc_success/empty', 'Bug ' + bug.id + ' - add file');
    var pull = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug.id + ' - integration test');

    var attachments = yield waitForAttachments(runtime, bug.id);
    yield reviewAttachment(runtime, attachments[0]);
    yield setCheckinNeeded(runtime, bug.id);

    // The invalid tc case should fail.
    yield waitForCheckinNeededRemoved(runtime, bug.id);

    // We should comment on the bug.
    var lookForComment = require('./../lib/github').COMMENTS.TASKGRAPH_POST_ERROR;
    yield waitForBugComment(runtime, bug.id, lookForComment);

    // The pull request should not be merged.
    pull1 = yield getPullRequest(runtime, 'autolander', 'autolander-test', pull.number);
    assert.equal(pull1.merged, false);
  }));
});
