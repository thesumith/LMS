/**
 * API Error Types
 * 
 * Standardized error handling for API routes
 */

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(404, message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class InternalServerError extends ApiError {
  constructor(message = 'Internal server error') {
    super(500, message, 'INTERNAL_ERROR');
    this.name = 'InternalServerError';
  }
}

/**
 * Format error response for API
 */
export function formatErrorResponse(error: unknown): {
  statusCode: number;
  body: { error: string; code?: string };
} {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  // Unknown error - don't expose details in production
  const message =
    process.env.NODE_ENV === 'development'
      ? error instanceof Error
        ? error.message
        : 'Unknown error'
      : 'Internal server error';

  return {
    statusCode: 500,
    body: {
      error: message,
      code: 'INTERNAL_ERROR',
    },
  };
}

