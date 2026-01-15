import { Request } from 'express';

/**
 * User payload attached to authenticated requests.
 * This is the shape returned by AuthService.validateJwtPayload().
 */
export interface ValidatedUserPayload {
  id: string; // Agent ID
  clientId: string;
  tenantId: string;
  name: string;
  tenant: {
    id: string;
    name: string;
  };
}

/**
 * Express Request with authenticated user payload.
 * Note: Don't use this type directly in decorated parameters due to
 * isolatedModules + emitDecoratorMetadata TypeScript restrictions.
 * Use getAuthUser(req) helper instead.
 */
export interface AuthenticatedRequest extends Request {
  user: ValidatedUserPayload;
}

/**
 * Helper to get typed user from request.
 * Use this in controller methods instead of typing the request parameter.
 *
 * @example
 * async getStats(@Request() req) {
 *   const user = getAuthUser(req);
 *   return this.service.getStats(user.tenantId);
 * }
 */
export function getAuthUser(req: Request): ValidatedUserPayload {
  return (req as AuthenticatedRequest).user;
}
