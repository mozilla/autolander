var assert = require('assert');
var co = require('co');
var fs = require('fs');
var helper = require('./helper');
var jsTemplate = require('json-templater/object');
var slugid = require('slugid');

var branchFromRef = require('./support/branch_from_ref');
var commitContent = require('./support/commit_content');
var createBug = require('./support/create_bug');
var createPullRequest = require('./support/create_pull_request');
var getPullComments = require('./support/get_pull_comments');
var reviewAttachment = require('./support/review_attachment');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForLandingComment = require('./support/wait_for_landing_comment');
var waitForResolvedFixed = require('./support/wait_for_resolved_fixed');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');

suite('commit message validation does not appear > ', function() {
  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('when bug has two pull requests and only one can land', co(function * () {
    var bug = yield createBug(runtime);

    yield commitContent(runtime, 'master', 'foo.txt', 'foo', 'Bug ' + bug.id + ' - add foo.txt');

    yield branchFromRef(runtime, 'branch1');
    yield commitContent(runtime, 'branch1', 'baz.txt', 'baz', 'some invalid commit message');
    var pull1 = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug.id + ' - non-landable, fails validation');

    yield branchFromRef(runtime, 'branch2');
    yield commitContent(runtime, 'branch2', 'foo.txt', 'bar', 'Bug ' + bug.id + ' - update foo.txt');
    var pull2 = yield createPullRequest(runtime, 'branch2', 'master', 'Bug ' + bug.id + ' - landable, passes validation');

    var attachments = yield waitForAttachments(runtime, bug.id, 2);
    yield reviewAttachment(runtime, attachments[1]);
    yield setCheckinNeeded(runtime, bug.id);

    // The empty tc case should pass immediately, and we should land and comment in the bug.
    yield waitForLandingComment(runtime, bug.id);
    yield waitForCheckinNeededRemoved(runtime, bug.id);
    yield waitForResolvedFixed(runtime, bug.id);

    // Sleep for 10 seconds or so and make sure that the pull request which should not be landed
    // does not receive any validation comments.
    yield runtime.sleep(10000);
    var comments = yield getPullComments(runtime, 'autolander', 'autolander-test', pull1.number);
    assert.equal(comments.length, 0);
  }));
});
