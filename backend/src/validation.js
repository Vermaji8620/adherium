function fail(message) {
  const e = new Error(message);
  e.status = 400;
  throw e;
}
function objectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    fail('Request body must be a JSON object.');
  return body;
}
function boundedString(v, name, min = 1, max = 4000) {
  if (typeof v !== 'string' || v.trim().length < min || v.length > max)
    fail(`${name} must be ${min}-${max} characters.`);
  return v.trim();
}
function pageQuery(q) {
  const page = Math.max(1, Number.parseInt(q.page || '1', 10));
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(q.limit || '25', 10)),
  );
  return { page, limit, skip: (page - 1) * limit };
}
function dates(q) {
  const filter = {};
  if (q.from) {
    const d = new Date(q.from);
    if (Number.isNaN(+d)) fail('from must be a valid date.');
    filter.$gte = d;
  }
  if (q.to) {
    const d = new Date(q.to);
    if (Number.isNaN(+d)) fail('to must be a valid date.');
    filter.$lte = d;
  }
  return filter;
}
module.exports = { objectBody, boundedString, pageQuery, dates, fail };
