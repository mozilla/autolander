var assert = require('assert');
var co = require('co');

var commitToBranch = require('./support/commit_to_branch');
var createBug = require('./support/create_bug');
var createPullRequest = require('./support/create_pull_request');
var branchFromMaster = require('./support/branch_from_master');
var waitForAttachments = require('./support/wait_for_attachments');

suite('attaches to bug', function() {

  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    var setup = require('./setup');
    return yield setup(runtime);
  }));

  suiteTeardown(co(function * () {
    var teardown = require('./teardown');
    return yield teardown(runtime);
  }));

  test('creating a pull request', co(function * () {
    yield commitToBranch(runtime, 'master', 'tc_repo/taskgraph.json');
    var bug = yield createBug(runtime);
    var ref = yield branchFromMaster(runtime, 'branch1');

    yield commitToBranch(runtime, 'branch1', 'tc_repo/empty');
    var pull = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug.id + ' - integration test');

    var attachments = yield waitForAttachments(runtime, bug.id);
    assert.equal(attachments.length, 1);

    var pullAttachment = attachments[0];
    assert.equal(pullAttachment.content_type, 'text/x-github-pull-request');
    assert.equal(pull.html_url, String(new Buffer(pullAttachment.data, 'base64')));
  }));
});
