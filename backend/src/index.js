const { createApp } = require('./create-app');
const { config } = require('./config');
const { connect } = require('./db');

const app = createApp({
  ensureDatabase(_req, _res, next) {
    connect(config().mongoUri).then(() => next(), next);
  },
});

module.exports = app;
