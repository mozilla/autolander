var assert = require('assert');
var bz = require('bz');
var co = require('co');
var helper = require('./helper');
var thunkify = require('thunkify');

var commitContent = require('./support/commit_content');
var createBug = require('./support/create_bug');
var createPullRequest = require('./support/create_pull_request');
var branchFromRef = require('./support/branch_from_ref');
var reviewAttachment = require('./support/review_attachment');
var requestReview = require('./support/request_review');
var setCheckinNeeded = require('./support/set_checkin_needed');
var waitForAttachments = require('./support/wait_for_attachments');
var waitForSuggestedReviewerComment = require('./support/wait_for_suggested_reviewer_comment');
var waitForCheckinNeededRemoved = require('./support/wait_for_checkin_needed_removed');
var waitForResolvedFixed = require('./support/wait_for_resolved_fixed');

suite('suggested reviewer forwards review > ', function() {

  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    return yield helper.teardown(runtime);
  }));

  test('will land the patch after a review', co(function * () {
    var bug = yield createBug(runtime);

    yield commitContent(runtime, 'master', 'foo.txt', 'foo', 'Bug ' + bug.id + ' - add foo.txt');
    yield branchFromRef(runtime, 'branch1');

    yield commitContent(runtime, 'branch1', 'foo.txt', 'bar', 'Bug ' + bug.id + ' - update foo.txt');
    var pull = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug.id + ' - integration test');

    var attachments = yield waitForAttachments(runtime, bug.id);

    // We've given our bot suggested review powers (only in the Gaia::GithubBot component)
    // So we forward the review to a user who is not a suggested reviewer.
    yield requestReview(runtime, attachments[0], runtime.config.bugzillaTestUser1.username);

    // Ensure that the bugzillaTestUser1 user is *not* in the suggested reviewer list.
    // This is to ensure that the test environment is properly setup.
    var getSuggestedReviewers = thunkify(runtime.bugzillaApi.getSuggestedReviewers.bind(runtime.bugzillaApi));
    var suggestedReviewers = yield getSuggestedReviewers(bug.id);
    suggestedReviewers.forEach(function(reviewer) {
      if (reviewer.email === runtime.config.bugzillaTestUser1.username) {
        assert.ok(false, 'should not find username in suggested reviewer list.');
      }
    });

    // Login with our new test user.
    runtime.bugzillaApi = bz.createClient(runtime.config.bugzillaTestUser1 || {});

    yield reviewAttachment(runtime, attachments[0]);
    yield setCheckinNeeded(runtime, bug.id);
    yield waitForResolvedFixed(runtime, bug.id);
  }));
});
