var assert = require('assert');
var co = require('co');
var fs = require('fs');
var helper = require('./helper');
var jsTemplate = require('json-templater/object');
var slugid = require('slugid');

var commitContent = require('./support/commit_content');
var createBug = require('./support/create_bug');
var createPullRequest = require('./support/create_pull_request');
var branchFromRef = require('./support/branch_from_ref');
var getPullRequest = require('./support/get_pull_request');
var reviewAttachment = require('./support/review_attachment');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');
var waitForLandingComment = require('./support/wait_for_landing_comment');
var waitForPullComments = require('./support/wait_for_pull_comments');

suite('multiple pull requests > ', function() {
  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('with multiple autoland requests', co(function * () {
    var taskgraph = fs.readFileSync(__dirname + '/fixtures/tc_success/taskgraph.json', 'utf-8');
    taskgraph = jsTemplate(taskgraph, {
      taskId: slugid.v4()
    });

    yield commitContent(runtime, 'master', 'taskgraph.json', taskgraph);
    var bug = yield createBug(runtime);

    yield branchFromRef(runtime, 'branch1');
    yield branchFromRef(runtime, 'branch2');

    yield commitContent(runtime, 'branch1', 'foo.txt', 'foo', 'Bug ' + bug.id + ' - add foo.txt');
    yield commitContent(runtime, 'branch2', 'bar.txt', 'bar', 'Bug ' + bug.id + ' - add bar.txt');

    var pull1 = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug.id + ' - foo');
    var attachments1 = yield waitForAttachments(runtime, bug.id);
    yield reviewAttachment(runtime, attachments1[0]);
    yield setCheckinNeeded(runtime, bug.id);
    yield waitForCheckinNeededRemoved(runtime, bug.id);
    yield waitForLandingComment(runtime, bug.id, 1);

    var pull2 = yield createPullRequest(runtime, 'branch2', 'master', 'Bug ' + bug.id + ' - bar');
    attachments = yield waitForAttachments(runtime, bug.id, 2);
    yield reviewAttachment(runtime, attachments[1]);
    yield setCheckinNeeded(runtime, bug.id);
    yield waitForCheckinNeededRemoved(runtime, bug.id);
    yield waitForLandingComment(runtime, bug.id, 2);

    // Assert that both pull requests are merged.
    pull1 = yield getPullRequest(runtime, 'autolander', 'autolander-test', pull1.number);
    pull2 = yield getPullRequest(runtime, 'autolander', 'autolander-test', pull2.number);
    assert.equal(pull1.merged, true);
    assert.equal(pull2.merged, true);
  }));
});
