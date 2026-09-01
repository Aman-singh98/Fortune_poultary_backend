export function apiError(res, status, message, details) {
  return res.status(status).json({ success: false, message, details });
}

export function apiSuccess(res, status, data, message) {
  return res.status(status).json({ success: true, message, data });
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
