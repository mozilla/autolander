var ngrok = require('ngrok');
var thunkify = require('thunkify');

ngrok.connect(8080, function (err, url) {
  console.log('Got url. Sending: ', url)
  process.send({ url: url + '/github' });
});
