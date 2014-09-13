module.exports = {
  port: process.env.port || 80,
  token: '<yourtokenhere>',
  bugzillaConfig: {
    url: "https://bugzilla.mozilla.org/rest/",
    username: 'bugs@bugmail.com',
    password: ''
  },
  bugzfeedConfig: {
    url: 'amqp://user:pass@pulse.mozilla.org',
    queueName: 'bugzfeed-name',
    exchange: 'exchange/bugzilla/simple'
  }
}
