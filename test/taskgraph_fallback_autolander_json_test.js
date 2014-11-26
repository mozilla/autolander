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
var branchFromRef = require('./support/branch_from_ref');
var reviewAttachment = require('./support/review_attachment');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForLandingComment = require('./support/wait_for_landing_comment');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');

suite('taskgraph selection > ', function() {
  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('uses autolander.json if it exists', co(function * () {
    var taskgraphFailure = fs.readFileSync(__dirname + '/fixtures/tc_failure/taskgraph.json', 'utf-8');
    taskgraphFailure = jsTemplate(taskgraphFailure, {
      taskId: slugid.v4()
    });

    var taskgraphSuccess = fs.readFileSync(__dirname + '/fixtures/tc_success/autolander.json', 'utf-8');
    taskgraphSuccess = jsTemplate(taskgraphSuccess, {
      taskId: slugid.v4()
    });

    yield commitContent(runtime, 'master', 'taskgraph.json', taskgraphFailure);
    yield commitContent(runtime, 'master', 'autolander.json', taskgraphSuccess);
    var bug1 = yield createBug(runtime);

    yield branchFromRef(runtime, 'branch1');
    yield commitContent(runtime, 'branch1', 'foo.txt', 'bar', 'Bug ' + bug1.id + ' - add foo.txt');

    // Submit the pull request which will fail.
    var pull1 = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug1.id + ' - Autolander test uses autolander.json');

    var attachments = yield waitForAttachments(runtime, bug1.id);
    yield reviewAttachment(runtime, attachments[0]);
    yield setCheckinNeeded(runtime, bug1.id);

    yield waitForCheckinNeededRemoved(runtime, bug1.id);
    yield waitForLandingComment(runtime, bug1.id);
  }));
});
