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
var reviewAttachment = require('./support/review_attachment');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');
var waitForPullComments = require('./support/wait_for_pull_comments');

suite('validates commit message title > ', function() {
  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('when missing a bug number', co(function * () {
    var taskgraph = fs.readFileSync(__dirname + '/fixtures/tc_success/taskgraph.json', 'utf-8');
    taskgraph = jsTemplate(taskgraph, {
      taskId: slugid.nice()
    });
    yield commitContent(runtime, 'master', 'taskgraph.json', taskgraph, 'Initial commit.');

    var bug = yield createBug(runtime);
    var ref = yield branchFromRef(runtime, 'branch1');

    yield commitContent(runtime, 'branch1', 'foo.txt', 'foo', 'no bug number =(');
    var pull = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug.id + ' - valid title, but not the commit message');

    var attachments = yield waitForAttachments(runtime, bug.id);
    yield reviewAttachment(runtime, attachments[0]);
    yield setCheckinNeeded(runtime, bug.id);

    var comments = yield waitForPullComments(runtime, 'autolander', 'autolander-test', pull.number);
    var expected = require('./../lib/github').COMMENTS.INVALID_COMMIT_NO_BUG;
    assert.equal(comments[0].body, expected);

    yield waitForCheckinNeededRemoved(runtime, bug.id);
  }));
});
