const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { notFound, errors } = require('./middleware');
const { api } = require('./routes');
const { config } = require('./config');
const { requireAuth } = require('./middleware/authentication');
const { createAuthRouter } = require('./routes/auth');
function createApp(options = {}) {
  const app = express();
  const auth = options.auth || config().auth;
  const protectedApi = options.apiRouter || api;
  const ensureDatabase =
    options.ensureDatabase || ((_req, _res, next) => next());
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (req, res, next) =>
    ensureDatabase(req, res, () =>
      res.json({
        status: 'ok',
        database:
          mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      }),
    ),
  );
  app.use('/api/v1', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/v1/auth', createAuthRouter(auth));
  app.use('/api/v1', requireAuth(auth), ensureDatabase, protectedApi);
  app.use(notFound);
  app.use(errors);
  return app;
}
module.exports = { createApp };
