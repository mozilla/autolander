var bugzilla = require('../lib/bugzilla');
var debug = require('debug')('autolander:route:taskgraph_update');
var github = require('../lib/github');
var removeBranch = require('../lib/github/remove_branch');
var Scheduler = require('taskcluster-client').Scheduler;
var thunkify = require('thunkify');

/**
 * Updates the github status API.
 * @param {Object} runtime
 * @param {Object} params The params object from the taskgraph tags. See taskgraph.js.
 * @param {String} status
 */
var updateStatus = function * (runtime, params, status) {
  var createStatus = thunkify(runtime.githubApi.statuses.create.bind(runtime.githubApi.statuses));
  var status = yield createStatus({
    user: params.githubBaseUser,
    repo: params.githubBaseRepo,
    sha: params.githubHeadRevision,
    state: status,
    description: 'Autolander status is ' + status,
    context: 'autolander',
    target_url: params.treeherderUrl,
    token: runtime.config.githubConfig.token
  });
  debug('set status', status);
  return status;
};

/**
 * Called when we receive an update for a taskgraph.
 * @param {Object} runtime
 * @param {Object} detail The update object from pulse.
 */
module.exports = function(runtime) {
  return function * (detail) {
    debug('detail', detail);
    var taskGraphId = detail.payload.status.taskGraphId;

    var scheduler = new Scheduler({
      credentials: {
        clientId: runtime.config.taskclusterConfig.clientId,
        accessToken: runtime.config.taskclusterConfig.accessToken
      }
    });

    var taskInfo = yield scheduler.info(taskGraphId);
    debug('scheduler info', taskInfo);
    debug(Date.now());

    var revisionInfo = JSON.parse(taskInfo.tags.revisions);
    var params = JSON.parse(taskInfo.tags.params);
    var bugId = parseInt(taskInfo.tags.bugId, 10);

    var isIntegrating = yield runtime.activeStore.isTaskgraphIntegrating(params.githubBaseUser, params.githubBaseRepo, taskGraphId);
    if (!isIntegrating) {
      debug('could not find active taskGraphId', taskGraphId);
      return;
    }

    params.treeherderUrl = runtime.config.treeherderConfig.baseUrl + 'ui/#/jobs?repo=gaia-try&revision=' + revisionInfo[0].revision;

    switch (detail.payload.status.state) {
      case 'running':
        debug('task is running');

        // Update the github status API.
        yield updateStatus(runtime, params, 'pending');
        break;
      case 'finished':
        // Update the github status API.
        yield updateStatus(runtime, params, 'success');

        // Update the base branch reference if successful.
        try {
          debug('pull request head sha', params.githubHeadRevision);
          debug('pull request merge sha to integration branch', params.githubPullMergeSha);

          var updateReference = thunkify(runtime.githubApi.gitdata.updateReference.bind(runtime.githubApi.gitdata));
          var ref = yield updateReference({
            user: params.githubBaseUser,
            repo: params.githubBaseRepo,
            ref: 'heads/' + params.githubBaseBranch,
            sha: params.githubPullMergeSha,
            token: runtime.config.githubConfig.token
          });
        } catch (e) {
          debug('could not update reference', e);

          // If we could not update the reference it means that the base branch has changed.
          // Rebuild the integration branch in this case, with all active jobs.
          yield rebuildIntegrationBranch(runtime, null, revisionInfo, params);

          return;
        }
        debug('reference updated', ref)

        yield notifyCoalescedBugs(runtime, params);
        break;
      case 'blocked':
        // Comment on bugzilla and github.
        var comment = 'http://docs.taskcluster.net/tools/task-graph-inspector/#' + detail.payload.status.taskGraphId + '\n\n' + github.COMMENTS.CI_FAILED;
        yield bugzilla.addCiFailedComment(runtime, bugId, comment);
        yield github.addComment(runtime, params.githubBaseUser, params.githubBaseRepo, params.githubPullNumber, comment);

        yield bugzilla.removeCheckinNeeded(runtime, bugId);
        yield rebuildIntegrationBranch(runtime, taskGraphId, revisionInfo, params);

        // Update the github status API.
        yield updateStatus(runtime, params, 'failure');
        break;
    }
  };
};

/** 
 * Rebuilds the integration branch after a failed taskgraph.
 * @param {Object} runtime
  * @param {String} taskgraphIdToRemove
 * @param {Object} revisionInfo
 * @param {Object} params
 */
var rebuildIntegrationBranch = function * (runtime, taskgraphIdToRemove, revisionInfo, params) {

  // Remove the integration branch.
  yield removeBranch(runtime, params.githubBaseUser, params.githubBaseRepo, 'integration-' + params.githubBaseBranch);

  // Re-create the integration branch.
  try {
    var getRef = thunkify(runtime.githubApi.gitdata.getReference.bind(runtime.githubApi.gitdata));
    var masterRef = yield getRef({
      user: params.githubBaseUser,
      repo: params.githubBaseRepo,
      ref: 'heads/' + params.githubBaseBranch,
      token: runtime.config.githubConfig.token
    });
    debug('got the base branch sha', params.githubBaseBranch, masterRef.object.sha);

    var createRef = thunkify(runtime.githubApi.gitdata.createReference.bind(runtime.githubApi.gitdata));
    var ref = yield createRef({
      user: params.githubBaseUser,
      repo: params.githubBaseRepo,
      ref: 'refs/heads/integration-' + params.githubBaseBranch,
      sha: masterRef.object.sha,
      token: runtime.config.githubConfig.token
    });
  } catch (e) {
    debug('could not create the integration branch', e);
  }

  // If we passed in a taskgraphId, remove it.
  if (taskgraphIdToRemove) {
    yield runtime.activeStore.stopTracking(taskgraphIdToRemove, params);
  }

  // Simulate a pulse update for each bug remaining.
  var bzPulse = require('./pulse_update')(runtime);

  var toIntegrate = yield runtime.activeStore.getCurrentIntegrations(params.githubBaseUser, params.githubBaseRepo);

  for (var i = 0; i < toIntegrate.length; i++) {

    var integration = toIntegrate[i];
    var eachBugId = integration.bugId;

    yield runtime.activeStore.stopTracking(integration.RowKey, integration);

    var getPullRequest = thunkify(runtime.githubApi.pullRequests.get.bind(runtime.githubApi.pullRequests));
    var pull = yield getPullRequest({
      user: integration.githubBaseUser,
      repo: integration.githubBaseRepo,
      number: integration.githubPullNumber,
      token: runtime.config.githubConfig.token
    });

    yield github.integratePullRequest(runtime, eachBugId, pull);
  }
}

/** 
 * Notifys all bugs which may have been merged in a coalesce success.
 * @param {Object} runtime
 * @param {Object} params
 */
var notifyCoalescedBugs = function * (runtime, params) {

  // Each bug in our actively tracked integration bugs will be landed.
  // Comment in each bug, and untrack the bugs.
  var integrations = yield runtime.activeStore.getCurrentIntegrations(params.githubBaseUser, params.githubBaseRepo);
  debug('got active integrations', integrations);
  for (var i = 0; i < integrations.length; i++) {
    var job = integrations[i];
    debug('notifying coalesced bug for job', job);

    try {
      var commitUrl = 'https://github.com/' + job.githubBaseUser + '/' + job.githubBaseRepo + '/commit/' + job.githubHeadRevision;
      yield bugzilla.addLandingComment(runtime, job.bugId, job.githubBaseBranch, commitUrl);
      yield bugzilla.removeCheckinNeeded(runtime, job.bugId);
      yield bugzilla.resolveFix(runtime, job.bugId);
    } catch (e) {
      debug('could not add landing commit', job, e);
    }

    // Stop tracking the task after processing.
    yield runtime.activeStore.stopTracking(job.RowKey, job);

    if (job.bugId == params.bugId) {
      break;
    }
  }

  // If there are no more currently integrating bugs, remove the integration branch.
  var remainingIntegrations = yield runtime.activeStore.getCurrentIntegrations(params.githubBaseUser, params.githubBaseRepo);
  debug('got remainingIntegrations', remainingIntegrations);
  if (!remainingIntegrations.length) {
    yield removeBranch(runtime, params.githubBaseUser, params.githubBaseRepo, 'integration-' + params.githubBaseBranch);
  }
};
