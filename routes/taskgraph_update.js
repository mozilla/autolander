var bugzilla = require('../lib/bugzilla');
var debug = require('debug')('autolander:route:taskgraph_update');
var github = require('../lib/github');
var thunkify = require('thunkify');

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

    var revisionInfo = JSON.parse(taskInfo.tags.revisions);
    var pullInfo = JSON.parse(taskInfo.tags.pull);
    var params = JSON.parse(taskInfo.tags.params);

    switch (detail.payload.status.state) {
      case 'running':
        debug('task is running');
        break;
      case 'finished':
        // Fast-forward the base branch if the run is successful.
        try {
          var updateRef = thunkify(runtime.githubApi.gitdata.updateReference.bind(runtime.githubApi.gitdata));
          var ref = yield updateRef({
            user: params.githubBaseUser,
            repo: params.githubBaseRepo,
            ref: 'heads/' + params.githubBaseBranch,
            sha: params.githubHeadRevision,
            token: runtime.config.githubConfig.token
          });
        } catch(e) {
          debug('error updating ref', e);
        }
        break;
      case 'blocked':
        // Re-create the integration branch on a failure, without the failed commit.
        break;
    }
  };
};
