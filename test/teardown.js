#! /usr/bin/env node --harmony

console.log('Test Teardown.');

var co = require('co');
var deleteRepo = require('./support/delete_repo');

co(function* () {
  var runtime = yield require('./support/runtime')();
  yield deleteRepo(runtime, 'autolander');
})();
