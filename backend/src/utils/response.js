const API_VERSION = '1.0';

function meta() {
  return { timestamp: new Date().toISOString(), version: API_VERSION };
}

function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data, meta: meta() });
}

function created(res, data) {
  return success(res, data, 201);
}

function list(res, data, pagination) {
  return res.status(200).json({ success: true, data, pagination, meta: meta() });
}

function noContent(res) {
  return res.status(204).send();
}

function error(res, statusCode, code, message, details = null) {
  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;
  return res.status(statusCode).json(body);
}

module.exports = { success, created, list, noContent, error };
