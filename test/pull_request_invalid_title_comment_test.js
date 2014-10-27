var assert = require('assert');
var co = require('co');

var commitToBranch = require('./support/commit_to_branch');
var createBug = require('./support/create_bug');
var createPullRequest = require('./support/create_pull_request');
var branchFromMaster = require('./support/branch_from_master');
var waitForPullComments = require('./support/wait_for_pull_comments');

suite('validates pull request title', function() {
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

  test('when missing a bug number', co(function * () {
    yield commitToBranch(runtime, 'master', 'tc_success/taskgraph.json');
    var bug = yield createBug(runtime);
    var ref = yield branchFromMaster(runtime, 'branch1');

    yield commitToBranch(runtime, 'branch1', 'tc_success/empty');
    var pull = yield createPullRequest(runtime, 'branch1', 'master', 'some invalid title');

    var comments = yield waitForPullComments(runtime, 'autolander', 'autolander-test', pull.number);
    var expected = require('./../lib/github').COMMENTS.NO_BUG_FOUND;
    assert.equal(comments[0].body, expected);
  }));
});
