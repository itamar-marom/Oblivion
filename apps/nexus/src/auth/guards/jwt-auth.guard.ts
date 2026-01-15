import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Socket } from 'socket.io';
import { Request } from 'express';

interface WebSocketHandshake {
  query?: { token?: string };
  auth?: { token?: string };
}

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
  getRequest(
    context: ExecutionContext,
  ): Request | { headers: { authorization: string } } {
    const contextType = context.getType();

    if (contextType === 'http') {
      return context.switchToHttp().getRequest<Request>();
    }

    // For WebSocket, extract from handshake
    if (contextType === 'ws') {
      const client = context.switchToWs().getClient<Socket>();
      const handshake = client.handshake as WebSocketHandshake;
      // Token should be in handshake query or auth
      return {
        headers: {
          authorization: `Bearer ${handshake?.query?.token || handshake?.auth?.token || ''}`,
        },
      };
    }

    return context.switchToHttp().getRequest<Request>();
  }
}
