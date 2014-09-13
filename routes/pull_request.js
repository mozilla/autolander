var bugzilla = require('../lib/bugzilla');
var bugzfeed = require('../lib/bugzfeed');
var github = require('../lib/github');

module.exports = function(runtime) {
  return function * () {

    var body = this.request.body;
    if (!body) {
      return this.throw(400, 'Must contain a body');
    }

    var repository = body.repository;
    var pullRequest = body.pull_request;
    var action = body.action;

    if (!pullRequest) {
      return this.throw(400, 'Invalid or missing pull request data');
    }

    // We don't need to do anything on closed PRs.
    if (action === 'closed') {
      this.status = 200;
      return;
    }

    // Validate that we have a bug number formatted to: "Bug xxxx - "
    var prTitle = pullRequest.title;
    var bugId = prTitle.match(/^Bug\s{1}([0-9]{5,})\s{1}-{1}\s{1}.*/);
    if (!bugId || !bugId[1]) {
      yield github.addComment(runtime, body, github.COMMENTS.NO_BUG_FOUND);
      return this.throw(400, 'Bug ID not found.');
    }
    bugId = bugId[1];

    yield bugzilla.attachPullRequest(runtime, bugId, body);
    yield bugzfeed.subscribe(runtime, bugId, body);

    // Everything was ok.
    this.status = 200;
  };
};