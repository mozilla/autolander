var thunkify = require('thunkify');

/**
 * Creates a bug.
 * @param {Object} runtime
 * @param {String} [summary] The bug summary.
 */
module.exports = function * (runtime, summary) {
  var newBug = {
    component: 'General',
    product: 'Firefox OS',
    op_sys: 'All',
    platform: "All",
    target_milestone: '---',
    version: "unspecified",
    summary: summary || 'Test autolander bug'
  };

  var createBug = thunkify(runtime.bugzillaApi.createBug.bind(runtime.bugzillaApi));
  var bugId = yield createBug(newBug);

  var getBug = thunkify(runtime.bugzillaApi.getBug.bind(runtime.bugzillaApi));
  return yield getBug(bugId);
};
