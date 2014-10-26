var thunkify = require('thunkify');

/**
 * Gets content from a branch.
 * @param {Object} runtime
 * @param {String} ref=master The ref name.
 * @param {String} path The path name of the file you want.
 * @param {String} field=content returns a field of your choice.
 * @seealso https://developer.github.com/v3/repos/contents/#create-a-file
 */
module.exports = function * (runtime, ref, path, field) {
  var getContent = thunkify(runtime.githubApi.repos.getContent.bind(runtime.githubApi.repos));
  var content = yield getContent({
    user: 'autolander',
    repo: 'autolander-test',
    path: path,
    ref: ref,
    token: runtime.config.githubConfig.token
  });

  if (field) {
    return content[field];
  }

  var b = new Buffer(content.content, 'base64')
  return b.toString();
};
