var debug = require('debug')('autolander:github:validator');
var bugzilla = require('./../bugzilla');
var github = require('./../github');
var thunkify = require('thunkify');

const BUG_PATTERN = /^.*Bug\s{1}([0-9]{5,})\s{1}-{1}\s{1}.*/;

/**
 * Validates that a pull request has a bug number.
 * Returns the bug number.
 * @param {Object} runtime
 * @param {Object} pull
 * @return {Number}
 */
exports.pullRequestHasBug = function * (runtime, pull) {
  var bugId = pull.title.match(BUG_PATTERN);
  if (!bugId || !bugId[1]) {
    var repoParts = pull.base.repo.full_name.split('/');
    yield github.addComment(runtime, repoParts[0], repoParts[1], pull.number, github.COMMENTS.NO_BUG_FOUND);
    debug('Bug ID not found.');
    return;
  }
  return bugId[1];
};

/**
 * Validates that the commits for a pull request contain bug numbers.
 * Comment on the pull request and remove autoland if any commit does not contain a bug number.
 * @param {Object} runtime
 * @param {Object} pull
 * @param {Object} bug A bug object from the bugzilla API.
 * @return {Boolean}
 */
exports.pullRequestCommitsHasBug = function * (runtime, pull, bug) {
  var repoParts = pull.base.repo.full_name.split('/');
  var getCommits = thunkify(runtime.githubApi.pullRequests.getCommits.bind(runtime.githubApi.pullRequests));
  var commits = yield getCommits({
    user: repoParts[0],
    repo: repoParts[1],
    number: pull.number,
    token: runtime.config.githubConfig.token
  });

  for (var i = 0; i < commits.length; i++) {
    var parsedBugId = commits[i].commit.message.match(BUG_PATTERN);
    if (!parsedBugId || !parsedBugId[1]) {
      // Comment on the github pull request and remove autoland if the bug has autoland.
      if (bug.keywords.indexOf('autoland') !== -1) {
        var repoParts = pull.base.repo.full_name.split('/');
        yield github.addComment(runtime, repoParts[0], repoParts[1], pull.number, github.COMMENTS.INVALID_COMMIT_NO_BUG);
        yield bugzilla.removeCheckinNeeded(runtime, bug.id);
      }
      debug('commit is missing bug number', commits[i]);
      return false;
    }
  }
  return true;
};
