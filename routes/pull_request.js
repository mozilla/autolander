var bugzilla = require('../lib/bugzilla');
var debug = require('debug')('autolander:route:pull_request');
var github = require('../lib/github');
var thunkify = require('thunkify');

module.exports = function(runtime) {
  return function * (detail) {

    if (!detail.repo || !detail.owner || !detail.number) {
      debug('Missing pull request info.');
      return;
    }

    var pullRequest = thunkify(runtime.githubApi.pullRequests.get.bind(runtime.githubApi.pullRequests));
    var pull = yield pullRequest({
      user: detail.owner,
      repo: detail.repo,
      number: detail.number,
      token: runtime.config.githubConfig.token
    });
    debug(pull);

    if (!pull) {
      debug('Invalid or missing pull request data');
      return;
    }

    // We don't need to do anything on closed PRs.
    if (pull.state !== 'open') {
      debug('pull request is not open', pull.state);
      this.status = 200;
      return;
    }

    // Validate that we have a bug number formatted to: "Bug xxxx - "
    // For now allow preceding characters to allow for reverts.
    var prTitle = pull.title;
    var bugId = prTitle.match(/^.*Bug\s{1}([0-9]{5,})\s{1}-{1}\s{1}.*/);
    if (!bugId || !bugId[1]) {
      var repoParts = pull.base.repo.full_name.split('/');
      yield github.addComment(runtime, repoParts[0], repoParts[1], pull.number, github.COMMENTS.NO_BUG_FOUND);
      debug('Bug ID not found.');
      return;
    }
    bugId = bugId[1];

    yield bugzilla.attachPullRequest(runtime, bugId, pull);
    yield runtime.pulseApi.subscribe(runtime, bugId);

    // Everything was ok.
    this.status = 200;
  };
};
