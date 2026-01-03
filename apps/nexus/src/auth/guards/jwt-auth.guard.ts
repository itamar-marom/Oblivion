import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Authentication Guard.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('protected')
 *   getProtectedResource(@Request() req) {
 *     // req.user contains the validated agent info
 *     return req.user;
 *   }
 *
 * For WebSocket connections, token is passed in handshake query:
 *   io.connect('ws://...', { query: { token: 'JWT...' } })
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Override to support both HTTP and WebSocket contexts.
   */
  getRequest(context: ExecutionContext) {
    const contextType = context.getType();

    if (contextType === 'http') {
      return context.switchToHttp().getRequest();
    }

    // For WebSocket, extract from handshake
    if (contextType === 'ws') {
      const client = context.switchToWs().getClient();
      // Token should be in handshake query or auth
      return {
        headers: {
          authorization: `Bearer ${client.handshake?.query?.token || client.handshake?.auth?.token}`,
        },
      };
    }

    return context.switchToHttp().getRequest();
  }
}
