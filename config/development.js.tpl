module.exports = {
  port: process.env.port || 80,
  githubConfig: {
    token: '<yourtokenhere>'
  },
  bugzillaConfig: {
    url: "https://bugzilla.mozilla.org/rest/",
    username: 'bugs@bugmail.com',
    password: ''
  },
  pulseConfig: {
    url: 'amqp://user:pass@pulse.mozilla.org',
    queueName: 'bugzfeed-name',
    exchange: 'exchange/bugzilla/simple'
  }
}
