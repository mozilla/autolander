var GitHubApi = require('node-github');
var thunkify = require('thunkify');

/**
 * Initializes the github API.
 */
exports.init = function *(config) {
  var githubApi = new GitHubApi({
    version: '3.0.0',
    debug: true,
    protocol: 'https',
    host: config.host,
    pathPrefix: '/api/v3',
    timeout: 5000
  });

  githubApi.authenticate({
    type: "oauth",
    token: config.githubConfig.token
  });

  return githubApi;
}

exports.COMMENTS = {
  NO_BUG_FOUND: 'Autolander could not find a bug number in your pull request title. All pull requests should be in the format of: Bug [number] - [description].'
};

/**
 * Comments on a pull request.
 * @param {Object} runtime
 * @param {Object} event
 * @param {String} comment
 */
exports.addComment = function *(runtime, event, comment) {
  var repoParts = event.pull_request.head.repo.full_name.split('/');

  var doComment = thunkify(runtime.githubApi.issues.createComment);
  yield doComment({
    body: comment,
    user: repoParts[0],
    repo: repoParts[1],
    number: event.number,
    token: runtime.config.githubConfig.token
  });
}
