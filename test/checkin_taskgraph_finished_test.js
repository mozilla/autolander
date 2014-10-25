var assert = require('assert');
var co = require('co');

suite('taskgraph finished', function() {

  var runtime;

  suiteSetup(co(function * () {
    runtime = yield require('./support/runtime')()
    var setup = require('./setup');
    return yield setup(runtime);
  }));

  suiteTeardown(co(function * () {
    var teardown = require('./teardown');
    return yield teardown(runtime);
  }));

  test('patch is autolanded', co(function * () {
    assert.ok(1);
  }));
});
