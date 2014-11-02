function E(key) {
  return process.env[key]
}

module.exports = {
  port: process.env.port || 80,
  amqpConfig: {
    autoDelete: true,
    exclusive: false,
    durable: false
  },
  azureConfig: {
    accountUrl: 'http://' + E('AZURE_ACCOUNT_NAME') + '.table.core.windows.net/',
    accountName: E('AZURE_ACCOUNT_NAME'),
    accountKey: E('AZURE_ACCOUNT_KEY')
  },
  githubConfig: {
    token: E('GITHUB_TOKEN')
  },
  bugzillaConfig: {
    url: "https://bugzilla.mozilla.org/rest/",
    username: E('BUGZILLA_EMAIL'),
    password: E('BUGZILLA_PASSWORD')
  },
  pulseConfig: {
    url: 'amqp://public:public@pulse.mozilla.org',
    queueName: 'gaia-autolander-prod',
    exchange: 'exchange/bugzilla/simple'
  },
  taskclusterConfig: {
    name: E('TC_CLIENT_NAME'),
    clientId: E('TC_CLIENT_ID'),
    accessToken: E('TC_CLIENT_TOKEN')
  },
  taskPulseConfig: {
    username: E('TC_PULSE_USER'),
    password: E('TC_PULSE_PASSWORD')
  },
  treeherderConfig: {
    name: 'gaia-try',
    baseUrl: 'https://treeherder.mozilla.org/api/',
    consumerKey: E('TREEHERDER_KEY'),
    consumerSecret: E('TREEHERDER_SECRET')
  }
}
