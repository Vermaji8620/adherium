const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { notFound, errors } = require('./middleware');
const { api } = require('./routes');
function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (req, res) =>
    res.json({
      status: 'ok',
      database:
        mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    }),
  );
  app.use('/api/v1', api);
  app.use(notFound);
  app.use(errors);
  return app;
}
module.exports = { createApp };
