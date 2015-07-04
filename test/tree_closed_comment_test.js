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
var waitForBugComment = require('./support/wait_for_bug_comment');

suite('when tree is closed > ', function() {
  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    return yield helper.setup(runtime);
  }));

  suiteTeardown(co(function * () {
    delete process.env['GITHUB_USERNAME'];
    delete process.env['GITHUB_TOKEN'];
    return yield helper.teardown(runtime);
  }));

  test('comments on bug and removes autoland', co(function * () {
    yield commitToBranch(runtime, 'master', 'tc_success/taskgraph.json');
    yield commitContent(runtime, 'master', 'foo.txt', 'foo');
    var bug1 = yield createBug(runtime);

    yield branchFromRef(runtime, 'branch1');

    yield commitContent(runtime, 'branch1', 'foo.txt', 'bar', 'Bug ' + bug1.id + ' - add foo.txt');

    var pull1 = yield createPullRequest(runtime, 'branch1', 'master', 'Bug ' + bug1.id + ' - mergeable');
    var attachments1 = yield waitForAttachments(runtime, bug1.id);

    // Now that the pull request is created, change the github token of the API user
    // to simulate being "removed" from a repo. Alternatively we could setup an entire
    // test org to better simulate gaia, but this should mimic the same environment.
    // In order to change the config, we stop, and restart the test servers.
    helper.killTestServers();
    process.env['GITHUB_USERNAME'] = runtime.config.githubTestUser.username;
    process.env['GITHUB_TOKEN'] = runtime.config.githubTestUser.token;
    helper.startTestServers();

    yield reviewAttachment(runtime, attachments1[0]);
    yield setCheckinNeeded(runtime, bug1.id);

    yield waitForCheckinNeededRemoved(runtime, bug1.id);

    // We should comment on the bug.
    var lookForComment = require('./../lib/github').COMMENTS.NON_COLLABORATOR;
    yield waitForBugComment(runtime, bug1.id, lookForComment);
  }));
});
