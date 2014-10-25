console.log('Test Teardown.');

var deleteRepo = require('./support/delete_repo');

module.exports = function *(runtime) {
  var runtime = yield require('./support/runtime')();
  // Commented out for now for testing.
  //yield deleteRepo(runtime, 'autolander');
};
