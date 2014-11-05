var fs = require('fs');
var thunkify = require('thunkify');

/**
 * Adds a file to a branch.
 * @param {Object} runtime
 * @param {String} branch The branch name.
 * @param {String} path Relative path of the file from the fixtures folder.
 * @seealso https://developer.github.com/v3/repos/contents/#create-a-file
 */
module.exports = function * (runtime, branch, path, message) {

  // The leafName is used for the commit message.
  var leafName = path.split('/').pop();

  // Do not use the first folder in the fixture for the path.
  var pathParts = path.split('/');
  pathParts.shift();
  var repoPath = pathParts.join('/');

  var content = fs.readFileSync(__dirname + '/../fixtures/' + path, 'utf8');
  content = new Buffer(content).toString('base64');

  yield runtime.sleep();
  var createFile = thunkify(runtime.githubApi.repos.createFile.bind(runtime.githubApi.repos));
  yield createFile({
    user: 'autolander',
    repo: 'autolander-test',
    message: message || 'Autolander test content, add ' + leafName,
    path: repoPath,
    content: content,
    branch: branch || 'master',
    token: runtime.config.githubConfig.token
  });
};
