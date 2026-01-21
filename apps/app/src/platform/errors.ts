export class HttpError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Validation error detail from Zod.
 */
export type ValidationErrorDetail = {
  path: string;
  message: string;
};

/**
 * Standardized error response shapes per API routing spec.
 */
export const ErrorResponses = {
  /**
   * Rate limit exceeded (429)
   * @param retryAfter - Seconds until rate limit resets
   */
  rateLimitExceeded(retryAfter: number): { error: string; retryAfter: number } {
    return {
      error: "rate_limit_exceeded",
      retryAfter,
    };
  },

  /**
   * Unauthorized - no/invalid credentials (401)
   */
  unauthorized(): { error: string } {
    return {
      error: "unauthorized",
    };
  },

  /**
   * Forbidden - valid credentials, insufficient permissions (403)
   * @param intent - The intent that was denied
   * @param reason - The reason for denial
   */
  forbidden(intent: string, reason?: string): { error: string; intent: string; reason?: string } {
    return {
      error: "forbidden",
      intent,
      ...(reason && { reason }),
    };
  },

  /**
   * Validation error (400)
   * @param details - Array of validation error details
   */
  validationError(details: ValidationErrorDetail[]): { error: string; details: ValidationErrorDetail[] } {
    return {
      error: "validation_error",
      details,
    };
  },

  /**
   * Not found (404)
   * @param resource - The resource type that was not found
   */
  notFound(resource?: string): { error: string; resource?: string } {
    return {
      error: "not_found",
      ...(resource && { resource }),
    };
  },
};

/**
 * Create HttpError for rate limit exceeded.
 */
export function rateLimitExceededError(retryAfter: number): HttpError {
  return new HttpError(429, "rate_limit_exceeded", "Rate limit exceeded", { retryAfter });
}

/**
 * Create HttpError for unauthorized.
 */
export function unauthorizedError(): HttpError {
  return new HttpError(401, "unauthorized", "Authentication required");
}

/**
 * Create HttpError for forbidden.
 */
export function forbiddenError(intent: string, reason?: string): HttpError {
  return new HttpError(403, "forbidden", "Access denied", { intent, reason });
}

/**
 * Create HttpError for validation error.
 */
export function validationError(details: ValidationErrorDetail[]): HttpError {
  return new HttpError(400, "validation_error", "Validation failed", { details });
}

/**
 * Create HttpError for not found.
 */
export function notFoundError(resource?: string): HttpError {
  return new HttpError(404, "not_found", resource ? `${resource} not found` : "Not found", { resource });
}
