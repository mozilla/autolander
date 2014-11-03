var debug = require('debug')('autolander:test:ngrok_runner');
var ngrok = require('ngrok');
var thunkify = require('thunkify');

ngrok.connect(8080, function (err, url) {
  debug('got url', url)
  process.send({ url: url + '/github' });
});
