var assert = require('assert');
var co = require('co');
var helper = require('./helper');

var commitContent = require('./support/commit_content');
var commitToBranch = require('./support/commit_to_branch');
var createBug = require('./support/create_bug');
var createPullRequest = require('./support/create_pull_request');
var branchFromRef = require('./support/branch_from_ref');
var reviewAttachment = require('./support/review_attachment');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');
var waitForLandingComment = require('./support/wait_for_landing_comment');
var waitForNonIntegrableBugComment = require('./support/wait_for_non_integrable_bug_comment');
var waitForPullComments = require('./support/wait_for_pull_comments');

suite('pull request which can not be applied to the integration branch > ', function() {
  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('comments on bug and removes autoland', co(function * () {
    yield commitToBranch(runtime, 'master', 'tc_success/taskgraph.json');
    yield commitContent(runtime, 'master', 'foo.txt', 'foo');
    var bug1 = yield createBug(runtime);
    var bug2 = yield createBug(runtime);

    yield branchFromRef(runtime, 'branch1');
    yield branchFromRef(runtime, 'branch2');

    yield commitContent(runtime, 'branch1', 'foo.txt', 'bar', 'Bug ' + bug1.id + ' - add foo.txt');
    yield commitContent(runtime, 'branch2', 'foo.txt', 'baz', 'Bug ' + bug2.id + ' - update foo.txt');

    var pull1 = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug1.id + ' - mergeable');
    var attachments1 = yield waitForAttachments(runtime, bug1.id);
    yield reviewAttachment(runtime, attachments1[0]);
    yield setCheckinNeeded(runtime, bug1.id);

    var pull2 = yield createPullRequest(runtime, 'branch2', 'master', 'Bug ' + bug2.id + ' - unmergeable');
    var attachments2 = yield waitForAttachments(runtime, bug2.id);
    yield reviewAttachment(runtime, attachments2[0]);
    yield setCheckinNeeded(runtime, bug2.id);

    var comments = yield waitForPullComments(runtime, 'autolander', 'autolander-test', pull2.number);
    var expected = require('./../lib/github').COMMENTS.NON_INTEGRABLE;
    assert.equal(comments[0].body, expected);

    yield waitForCheckinNeededRemoved(runtime, bug1.id);
    yield waitForCheckinNeededRemoved(runtime, bug2.id);

    yield waitForLandingComment(runtime, bug1.id);
    yield waitForNonIntegrableBugComment(runtime, bug2.id);
  }));
});
