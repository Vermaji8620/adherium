const {
  getSessionToken,
  isAuthConfigured,
  verifySession,
} = require('../auth/session');

function sendAuthNotConfigured(res) {
  return res.status(503).json({
    error: {
      code: 'AUTH_NOT_CONFIGURED',
      message: 'Authentication is not configured on this server.',
    },
  });
}

function sendUnauthenticated(res) {
  return res.status(401).json({
    error: {
      code: 'UNAUTHENTICATED',
      message: 'You are not authenticated. Sign in to continue.',
    },
  });
}

function requireAuth(auth) {
  return (req, res, next) => {
    if (!isAuthConfigured(auth)) return sendAuthNotConfigured(res);
    const session = verifySession(getSessionToken(req), auth.secret);
    if (!session) return sendUnauthenticated(res);
    req.auth = { email: session.email };
    next();
  };
}

module.exports = { requireAuth, sendAuthNotConfigured, sendUnauthenticated };
