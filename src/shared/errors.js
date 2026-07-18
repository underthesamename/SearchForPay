export class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = options.statusCode || 500;
    this.code = options.code || 'INTERNAL_ERROR';
    this.details = options.details || undefined;
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details
    });
  }
}

export class ConfigurationError extends AppError {
  constructor(message, details) {
    super(message, {
      statusCode: 500,
      code: 'CONFIGURATION_ERROR',
      details
    });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message, details) {
    super(message, {
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      details
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message, details) {
    super(message, {
      statusCode: 404,
      code: 'NOT_FOUND',
      details
    });
  }
}

export function toPublicError(error) {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'Erro interno inesperado.'
  };
}
