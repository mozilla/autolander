var thunkify = require('thunkify');

/**
 * Creates a bug.
 * @param {Object} runtime
 * @param {String} [summary] The bug summary.
 * @param {String} [component] The bug component.
 */
module.exports = function * (runtime, summary, component) {
  var newBug = {
    summary: summary || 'Test autolander bug',
    component: component || 'Gaia::GithubBot',
    product: 'Firefox OS',
    op_sys: 'All',
    platform: "All",
    target_milestone: '---',
    version: "unspecified"
  };

  var createBug = thunkify(runtime.bugzillaApi.createBug.bind(runtime.bugzillaApi));
  var bugId = yield createBug(newBug);

  var getBug = thunkify(runtime.bugzillaApi.getBug.bind(runtime.bugzillaApi));
  return yield getBug(bugId);
};
