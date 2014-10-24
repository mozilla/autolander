var bugzilla = require('../lib/bugzilla');
var debug = require('debug')('autolander:route:taskgraph_update');
var github = require('../lib/github');

var Scheduler = require('taskcluster-client').Scheduler;

/**
 * Called when we receive an update for a taskgraph.
 * @param {Object} runtime
 * @param {Object} detail The update object from pulse.
 */
module.exports = function(runtime) {
  return function * (detail) {
    debug('detail', detail);

    var scheduler = new Scheduler({
      credentials: {
        clientId: runtime.config.taskclusterConfig.clientId,
        accessToken: runtime.config.taskclusterConfig.accessToken
      }
    });

    var taskInfo = yield scheduler.info(detail.payload.status.taskGraphId);
    debug('scheduler info', taskInfo);

    var revisionInfo = JSON.stringify(taskInfo.tags.revisions);
    var pullInfo = JSON.stringify(taskInfo.tags.pull);
    var params = JSON.stringify(taskInfo.tags.params);

    switch(detail.payload.status.state) {
      case 'running':
        // TODO: Comment on pull request that we are running this.
        break;
      case 'finished':
        // TODO: Fast-forward the master ref.
        // params.githubHeadRevision
        break;
      case 'blocked':
        // TODO: Crazy things.
        break;
    }
  };
};
