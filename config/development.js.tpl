module.exports = {
  port: process.env.port || 80,
  azureConfig: {
    accountUrl: 'http://accountName.table.core.windows.net/',
    accountName: 'accountName',
    accountKey: 'theKey'
  },
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
  },
  taskclusterConfig: {
    name: '',
    clientId: '',
    accessToken: ''
  },
  treeherderConfig: {
    name: '',
    baseUrl: 'https://treeherder.mozilla.org/api/',
    consumerKey: '',
    consumerSecret: ''
  }
}
