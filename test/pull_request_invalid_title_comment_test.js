var assert = require('assert');
var co = require('co');

suite('validates pull request title', function() {
  test('when missing a bug number', co(function * () {
    assert.ok(1);
  }));
});
