var assert = require('assert');
var co = require('co');

suite('validates pull request title', function() {

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

  test('when missing a bug number', co(function * () {
    assert.ok(1);
  }));
});
