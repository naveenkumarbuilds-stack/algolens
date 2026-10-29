export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

export function errorHandler(error, req, res, _next) {
  let status = error.status || 500;
  let code = error.code || 'INTERNAL_ERROR';
  let message = error.message;
  if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body must be valid JSON';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  } else if (error.code === 'P2002') {
    status = 409;
    code = 'EMAIL_EXISTS';
    message = 'An account with this email already exists';
  } else if (!(error instanceof ApiError)) {
    if (status !== 400 && status !== 413) status = 500;
    if (status === 500) {
      console.error(
        JSON.stringify({ requestId: req.id, message: 'Unexpected server error', name: error.name }),
      );
      code = 'INTERNAL_ERROR';
      message = 'Something went wrong';
    }
  }
  res.status(status).json({
    error: { code, message, ...(error.details && { details: error.details }), requestId: req.id },
  });
}
