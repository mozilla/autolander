var assert = require('assert');
var co = require('co');

suite('attaches to bug', function() {
  test('creating a pull request', co(function * () {
    assert.ok(1);
  }));
});
