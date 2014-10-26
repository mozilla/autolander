console.log('Test Setup.');

var childProcess = require('child_process');
var co = require('co');
var createRepo = require('./support/create_repo');
var deleteRepo = require('./support/delete_repo');
var thunkify = require('thunkify');

function getTunnelUrl() {
  return function(fn) {
    var ngrok = childProcess.fork('./test/ngrok_runner.js')
    process.on('exit', function() {
      ngrok.kill();
    });
    ngrok.on('message', function(m) {
      console.log('Url is:', m.url);
      fn(null, m.url);
    });
    ngrok.on('exit', function(data) {
      console.log('ngrok exit ' + data);
    });
    ngrok.on('close', function(data) {
      console.log('ngrok close ' + data);
    });
    ngrok.on('error', function(data) {
      console.log('ngrok error ' + data);
    });
  };
}

module.exports = function *(runtime) {

  // Try to start from a clean slate.
  // Delete the repo if it exists.
  try {
    yield deleteRepo(runtime, 'autolander');
  } catch(e) {}

  yield createRepo(runtime, 'autolander');
  var thunkTunnelUrl = thunkify(getTunnelUrl());
  var tunnelUrl = yield thunkTunnelUrl();

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