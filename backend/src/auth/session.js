const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const COOKIE_NAME = 'adherium_session';
const SESSION_SECONDS = 8 * 60 * 60;
const KEY_LENGTH = 64;

function decodeBase64Url(value) {
  if (typeof value !== 'string' || !value) return null;
  const decoded = Buffer.from(value, 'base64url');
  return decoded.toString('base64url') === value ? decoded : null;
}

function parsePasswordHash(value) {
  if (typeof value !== 'string') return null;
  const [algorithm, saltText, digestText, ...extra] = value.split('$');
  if (algorithm !== 'scrypt' || !saltText || !digestText || extra.length)
    return null;
  const salt = decodeBase64Url(saltText);
  const digest = decodeBase64Url(digestText);
  if (!salt || salt.length < 16 || !digest || digest.length !== KEY_LENGTH)
    return null;
  return { salt, digest };
}

function isAuthConfigured(auth) {
  return Boolean(
    auth &&
    typeof auth.email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(auth.email) &&
    parsePasswordHash(auth.passwordHash) &&
    typeof auth.secret === 'string' &&
    Buffer.byteLength(auth.secret, 'utf8') >= 32,
  );
}

async function hashPassword(password, salt = crypto.randomBytes(16)) {
  if (typeof password !== 'string' || password.length < 12)
    throw new Error('Password must be at least 12 characters.');
  const digest = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64url')}$${digest.toString('base64url')}`;
}

async function verifyPassword(password, encodedHash) {
  const parsed = parsePasswordHash(encodedHash);
  if (!parsed || typeof password !== 'string') return false;
  const candidate = await scrypt(password, parsed.salt, parsed.digest.length);
  return crypto.timingSafeEqual(candidate, parsed.digest);
}

function signSession(email, secret, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: email,
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + SESSION_SECONDS,
    }),
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function verifySession(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || typeof secret !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signatureText] = parts;
  const signature = decodeBase64Url(signatureText);
  if (!signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest();
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(signature, expected)
  )
    return null;
  const payloadBuffer = decodeBase64Url(payload);
  if (!payloadBuffer) return null;
  try {
    const session = JSON.parse(payloadBuffer.toString('utf8'));
    const nowSeconds = Math.floor(now / 1000);
    if (
      typeof session.sub !== 'string' ||
      !session.sub ||
      !Number.isInteger(session.exp) ||
      session.exp <= nowSeconds ||
      session.exp > nowSeconds + SESSION_SECONDS
    )
      return null;
    return { email: session.sub, expiresAt: session.exp };
  } catch {
    return null;
  }
}

function getSessionToken(req) {
  const cookie = req.headers.cookie || '';
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === COOKIE_NAME)
      return part.slice(separator + 1).trim();
  }
  return null;
}

function setSessionCookie(res, token, secure = false) {
  const attributes = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${SESSION_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(res, secure = false) {
  const attributes = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}

module.exports = {
  COOKIE_NAME,
  SESSION_SECONDS,
  clearSessionCookie,
  getSessionToken,
  hashPassword,
  isAuthConfigured,
  setSessionCookie,
  signSession,
  verifyPassword,
  verifySession,
};
