var TreeherderProject = require('mozilla-treeherder/project');
var TreehederGHFactory = require('mozilla-treeherder/factory/github');
var GraphFactory = require('taskcluster-task-factory/graph');
var Scheduler = require('taskcluster-client').Scheduler;

var debug = require('debug')('autolander:taskgraph');
var jsTemplate = require('json-templater/object');
var merge = require('deap').merge;
var slugid = require('slugid');
var thunkify = require('thunkify');

const GITHUB_CONTENT_URL = 'https://raw.githubusercontent.com';
const PROJECT_NAME = 'gaia-try';
const TASKGRAPH_PATH = 'taskgraph.json';
const TREEHERDER_ROUTE = 'treeherder';
const TASKCLUSTER_ROUTE = 'gaia-autolander';

var fetchContent = function * (runtime, user, repo, path) {
  var getContent = thunkify(runtime.githubApi.repos.getContent.bind(runtime.githubApi.repos));
  var content = yield getContent({
    user: user,
    repo: repo,
    path: path,
    token: runtime.config.githubConfig.token
  });

  var b = new Buffer(content.content, 'base64')
  return b.toString();
};

var formatCommitsForResultSet = function(project, commits) {
  return commits.map(function(commit) {
    return {
      comment: commit.message,
      revision: commit.tree.sha,
      repository: project,
      author: commit.committer.name + ' <' + commit.committer.email + '>'
    };
  });
};

var getDefaultTask = function() {
  return {
    provisionerId: 'aws-provisioner',
    workerType: 'v2',
    retries: 5,
    extra: {
      github: {
        baseUser: '{{githubBaseUser}}',
        baseRepo: '{{githubBaseRepo}}',
        baseRevision: '{{githubBaseRevision}}',
        baseBranch: '{{githubBaseBranch}}',

        headUser: '{{githubHeadUser}}',
        headRepo: '{{githubHeadRepo}}',
        headRevision: '{{githubBaseRevision}}}',
        headBranch: '{{githubHeadBranch}}',
      }
    },
    metadata: {},
    payload: {
      env: {
        CI: true,
        GITHUB_PULL_REQUEST: '0',

        // Base details
        GITHUB_BASE_REPO: '{{githubBaseRepo}}',
        GITHUB_BASE_USER: '{{githubBaseUser}}',
        GITHUB_BASE_GIT: 'https://github.com/{{githubBaseUser}}/{{githubBaseRepo}}',
        GITHUB_BASE_REV: '{{githubBaseRevision}}',
        GITHUB_BASE_BRANCH: '{{githubBaseBranch}}',

        // Head details
        GITHUB_HEAD_REPO: '{{githubHeadRepo}}',
        GITHUB_HEAD_USER: '{{githubHeadUser}}',
        GITHUB_HEAD_GIT: 'https://github.com/{{githubHeadUser}}/{{githubHeadRepo}}',
        GITHUB_HEAD_REV: '{{githubHeadRevision}}',
        GITHUB_HEAD_BRANCH: '{{githubHeadBranch}}',

        // Treeherder
        TREEHERDER_PROJECT: '{{treeherderRepo}}',
        TREEHERDER_REVISION: '{{githubHeadRevision}}'
      },
      maxRunTime: 7200,
      features: {}
    }
  };
};

exports.TASKCLUSTER_ROUTE = TASKCLUSTER_ROUTE;

/**
 * Creates a taskgraph for processing on treeherder.
 * @seealso https://github.com/lightsofapollo/gaia-taskcluster
 */
exports.create = function * (runtime, bugId, pull) {

  var branch = 'integration-' + pull.base.ref;
  var repoParts = pull.head.repo.full_name.split('/');

  // Get the commits for the pull request
  var getCommits = thunkify(runtime.githubApi.pullRequests.getCommits.bind(runtime.githubApi.pullRequests));
  var commits = yield getCommits({
    user: repoParts[0],
    repo: repoParts[1],
    number: pull.number,
    token: runtime.config.githubConfig.token
  });
  commits = commits.map(function(item) {
    return item.commit;
  });
  debug('got commits', commits);

  // Owner email address note that we use who submitted the pr not who
  // authored the code originally.
  var fakeEmailDomain = 'autolander.taskcluster.net';
  var owner = pull.user.login + '@' + fakeEmailDomain;

  var resultset = {
    revision_hash: pull.head.sha,
    type: 'push',
    author: owner,
    revisions: formatCommitsForResultSet(PROJECT_NAME, commits),
    push_timestamp: (new Date(pull.updated_at).valueOf()) / 1000
  };
  debug('built resultset', resultset);

  // submit the resultset to treeherder
  var thConfig = runtime.config.treeherderConfig;
  var thRepository = new TreeherderProject(PROJECT_NAME, {
    consumerKey: thConfig.consumerKey,
    consumerSecret: thConfig.consumerSecret,
    baseUrl: thConfig.baseUrl
  });
  debug('created treeherder project', thRepository);
  yield thRepository.postResultset([resultset]);

  var graph = JSON.parse(
    yield fetchContent(runtime, repoParts[0], repoParts[1], TASKGRAPH_PATH)
  );
  debug('fetched graph', graph);

  var source = GITHUB_CONTENT_URL + '/' +
    repoParts[0] + '/' +
    repoParts[1] + '/' +
    branch + '/' +
    TASKGRAPH_PATH;

  var params = {
    // Base repository details...
    githubBaseRepo: repoParts[1],
    githubBaseUser: repoParts[0],
    githubBaseRevision: pull.base.sha,
    githubBaseBranch: pull.base.ref,
    // Head repository details are the same as base for push.
    githubHeadRepo: repoParts[1],
    githubHeadUser: repoParts[0],
    githubHeadRevision: pull.head.sha,
    githubHeadBranch: branch,
    // Treeherder details...
    treeherderRepo: PROJECT_NAME
  };

  graph = merge(
    // remember these values _override_ values set elsewhere
    {
      scopes: ['*'],
      metadata: {
        owner: owner,
        source: source,
      },
      routes: [
        [
          TASKCLUSTER_ROUTE,
          pull.number,
          repoParts[0],
          repoParts[1]
        ].join('.')
      ],
      tags: {
        revisions: JSON.stringify(resultset.revisions),
        pull: JSON.stringify({
          user: repoParts[0],
          repo: repoParts[1],
          number: pull.number,
          bugId: bugId
        }),
        params: JSON.stringify(params)
      }
    },
    // original graph from github
    graph
    // defaults set by config
    // runtime.graph
  );

  graph.tasks = graph.tasks.map(function(task) {
    var task = merge(
      // strict overrides
      {
        task: {
          metadata: {
            owner: owner,
            source: source
          },
        }
      },
      // original task in the graph
      task,
      // defaults set by config
      {
        task: getDefaultTask()
      }
    );
    task.task.routes = task.task.routes || [];
    task.task.scopes = task.task.scopes || [];

    // Gaia scopes.
    task.task.routes.push(TASKCLUSTER_ROUTE);
    task.task.scopes.push('queue:route:' + TASKCLUSTER_ROUTE);

    // Treeherder
    var treeherderRoute = TREEHERDER_ROUTE + '.' +
      PROJECT_NAME + '.' +
      pull.head.sha;
    task.task.routes.push(treeherderRoute);
    task.task.scopes.push(treeherderRoute);
    return task;
  });
  graph = GraphFactory.create(jsTemplate(graph, params));

  var createdTasks = graph.tasks.map(function(task) {
    return task.taskId;
  });

  var id = slugid.v4();
  debug('create graph', {
    id: id,
    graph: JSON.stringify(graph)
  });

  var scheduler = new Scheduler({
    credentials: {
      clientId: runtime.config.taskclusterConfig.clientId,
      accessToken: runtime.config.taskclusterConfig.accessToken
    }
  });
  var graphStatus = yield scheduler.createTaskGraph(id, graph);
  debug('scheduled graph', graphStatus);
};
