var debug = require('debug')('utils:github:fetch_content');
var thunkify = require('thunkify');

/**
 * Fetches content from github.
 * @param {Object} runtime
 * @param {String} user
 * @param {String} repo
 * @param {String} ref
 * @param {String} path
 */

module.exports = function * (runtime, user, repo, ref, path) {
  var getContent = thunkify(runtime.githubApi.repos.getContent.bind(runtime.githubApi.repos));
  var content = yield getContent({
    user: user,
    repo: repo,
    path: path,
    ref: ref,
    token: runtime.config.githubConfig.token
  });

  var b = new Buffer(content.content, 'base64')
  return b.toString();
};
