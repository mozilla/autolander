var childProcess = require('child_process');
var co = require('co');
var createRepo = require('./support/create_repo');
var debug = require('debug')('test:setup');
var deleteRepo = require('./support/delete_repo');
var spawn = childProcess.spawn;
var thunkify = require('thunkify');

debug('test setup');

var childProcesses = [];

process.on('exit', function() {
  childProcesses.forEach(function(child) {
    child.kill();
  });
});

function getTunnelUrl() {
  return function(fn) {
    var ngrok = childProcess.fork('./test/ngrok_runner.js')
    childProcesses.push(ngrok);
    ngrok.on('message', function(m) {
      debug('Url is:', m.url);
      fn(null, m.url);
    });
    ngrok.on('exit', function(data) {
      debug('ngrok exit ' + data);
    });
    ngrok.on('close', function(data) {
      debug('ngrok close ' + data);
    });
    ngrok.on('error', function(data) {
      debug('ngrok error ' + data);
    });
  };
}

module.exports = function *(runtime) {

  // Try to start from a clean slate.
  // Delete the repo if it exists.
  try {
    yield deleteRepo(runtime, 'autolander');
  } catch(e) {
    debug('could not delete repo');
  }

  debug('creating autolander-test repoitory');
  yield createRepo(runtime, 'autolander');
  var thunkTunnelUrl = thunkify(getTunnelUrl());
  var tunnelUrl = yield thunkTunnelUrl();

  debug('starting the web server and worker');
  var worker = spawn('node', [
      '--harmony',
      './bin/worker',
    ], {
    execArgv: ['--harmony'],
    stdio: 'pipe'
  });
  childProcesses.push(worker);

  var web = spawn('node', [
      '--harmony',
      './bin/web'
    ], {
    execArgv: ['--harmony'],
    stdio: 'pipe'
  });
  childProcesses.push(web);

  debug('attaching github hook', tunnelUrl);
  var createHook = thunkify(runtime.githubApi.repos.createHook.bind(runtime.githubApi.repos));
  var hookReq = yield createHook({
    user: 'autolander',
    repo: 'autolander-test',
    name: 'web',
    active: true,
    events: [
      'push',
      'pull_request'
    ],
    config: {
      url: tunnelUrl,
      content_type: 'json'
    },
    token: runtime.config.githubConfig.token
  });
};
