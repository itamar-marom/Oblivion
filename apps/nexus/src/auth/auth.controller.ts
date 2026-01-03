import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenRequestDto } from './dto/token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';

/**
 * Authentication Controller.
 *
 * Implements OAuth2 Client Credentials flow for agent authentication.
 *
 * Endpoint:
 *   POST /auth/token
 *   Body: { "client_id": "...", "client_secret": "..." }
 *   Response: { "access_token": "...", "token_type": "Bearer", "expires_in": 3600 }
 */
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Issue access token for agent authentication.
   *
   * @example
   * curl -X POST http://localhost:3000/auth/token \
   *   -H "Content-Type: application/json" \
   *   -d '{"client_id": "agent_xxx", "client_secret": "secret_xxx"}'
   */
  @Post('token')
  @HttpCode(HttpStatus.OK)
  async token(@Body() dto: TokenRequestDto): Promise<TokenResponseDto> {
    return this.authService.validateAndIssueToken(dto);
  }
}
