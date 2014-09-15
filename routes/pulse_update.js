var bugzilla = require('../lib/bugzilla');
var github = require('../lib/github');

/**
 * Called when we receive an update from pulse.
 * @param {Object} runtime
 * @param {Object} pulse The update object from pulse.
 */
module.exports = function(runtime) {
  return function * (pulse) {
    console.log('Got pulse:', pulse)
  };
};