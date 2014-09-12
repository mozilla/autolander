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

    // XXX: Validate pull request message.
    // XXX: Comment on bugzilla.

    // Everything was ok.
    this.status = 200;
  };
};