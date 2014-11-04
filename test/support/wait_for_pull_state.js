var getStatusesFromBranchTip = require('./get_statuses_from_branch_tip');
var Promise = require('promise');

var WAIT_INTERVAL = 5000;
var MAX_TRIES = 20;

/**
 * Waits for a pull request to have a certain status.
 * @param {Object} runtime
 * @param {String} head
 * @param {String} base
 * @param {String} branch
 * @param {String} state
 */
module.exports = function * (runtime, user, repo, branch, state) {
  var tries = 0;
  while (tries++ < MAX_TRIES) {
    var statuses = yield getStatusesFromBranchTip(runtime, user, repo, branch);
    if (statuses.length >= 1 && statuses[0].state === state){
      return statuses;
    }
    yield runtime.sleep(WAIT_INTERVAL);
  }
  throw new Error('Cound not find pull request comment.');
};
