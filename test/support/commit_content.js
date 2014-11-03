var fs = require('fs');
var thunkify = require('thunkify');

var getContent = require('./get_content');

/**
 * Commits content to a branch. If it the remote file exists, update it, otherwise create it.
 * @param {Object} runtime
 * @param {String} branch The branch name.
 * @param {String} repoPath Where the content lives in the repo.
 * @param {String} content Content to encode and commit.
 * @param {String} message= The commit message to use.
 * @seealso https://developer.github.com/v3/repos/contents/#create-a-file
 */
module.exports = function * (runtime, branch, repoPath, content, message) {
  content = new Buffer(content).toString('base64');

  var existingSha;
  yield runtime.sleep();

  try {
    existingSha = yield getContent(runtime, branch, repoPath, 'sha');
  } catch (e) {}

  yield runtime.sleep();
  if (existingSha) {
    var updateFile = thunkify(runtime.githubApi.repos.updateFile.bind(runtime.githubApi.repos));
    yield updateFile({
      user: 'autolander',
      repo: 'autolander-test',
      message: message || 'Autolander test, update ' + repoPath,
      path: repoPath,
      content: content,
      branch: branch || 'master',
      sha: existingSha,
      token: runtime.config.githubConfig.token
    });
  } else {
    var createFile = thunkify(runtime.githubApi.repos.createFile.bind(runtime.githubApi.repos));
    yield createFile({
      user: 'autolander',
      repo: 'autolander-test',
      message: message || 'Autolander test, add ' + repoPath,
      path: repoPath,
      content: content,
      branch: branch || 'master',
      token: runtime.config.githubConfig.token
    });
  }
};
