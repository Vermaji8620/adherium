function notFound(req, res) {
  res
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
}
function errors(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status =
    err.status ||
    (err.name === 'CastError'
      ? 400
      : err.name === 'ValidationError'
        ? 400
        : 500);
  const message =
    status >= 500 ? 'Request could not be completed.' : err.message;
  res.status(status).json({
    error: {
      code: status === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST',
      message,
    },
  });
}
module.exports = { notFound, errors };
