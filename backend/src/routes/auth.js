const express = require('express');
const {
  clearSessionCookie,
  getSessionToken,
  isAuthConfigured,
  setSessionCookie,
  signSession,
  verifyPassword,
  verifySession,
} = require('../auth/session');
const {
  sendAuthNotConfigured,
  sendUnauthenticated,
} = require('../middleware/authentication');

function createAuthRouter(auth) {
  const router = express.Router();
  const secureCookie = auth?.nodeEnv === 'production';

  router.post('/login', async (req, res, next) => {
    if (!isAuthConfigured(auth)) return sendAuthNotConfigured(res);
    const { email, password } = req.body || {};
    if (
      typeof email !== 'string' ||
      email.length > 320 ||
      typeof password !== 'string' ||
      password.length > 1024
    )
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email or password is incorrect.',
        },
      });

    try {
      const passwordMatches = await verifyPassword(password, auth.passwordHash);
      const emailMatches =
        email.trim().toLowerCase() === auth.email.toLowerCase();
      if (!passwordMatches || !emailMatches)
        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email or password is incorrect.',
          },
        });
      const token = signSession(auth.email.toLowerCase(), auth.secret);
      setSessionCookie(res, token, secureCookie);
      return res.json({ authenticated: true, email: auth.email.toLowerCase() });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/session', (req, res) => {
    if (!isAuthConfigured(auth)) return sendAuthNotConfigured(res);
    const session = verifySession(getSessionToken(req), auth.secret);
    if (!session) return sendUnauthenticated(res);
    return res.json({ authenticated: true, email: session.email });
  });

  router.post('/logout', (_req, res) => {
    clearSessionCookie(res, secureCookie);
    return res.json({ authenticated: false });
  });

  return router;
}

module.exports = { createAuthRouter };
