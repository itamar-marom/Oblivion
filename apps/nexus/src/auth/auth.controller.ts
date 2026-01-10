import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenRequestDto } from './dto/token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { RegisterAgentDto } from './dto/register-agent.dto';

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

  /**
   * Register a new agent using a registration token.
   *
   * This endpoint does NOT require authentication - the registration token
   * serves as the authorization mechanism.
   *
   * @example
   * curl -X POST http://localhost:3000/auth/register \
   *   -H "Content-Type: application/json" \
   *   -d '{
   *     "registrationToken": "reg_xxxx",
   *     "name": "My Agent",
   *     "clientId": "my-agent",
   *     "clientSecret": "super_secret_123"
   *   }'
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterAgentDto) {
    return this.authService.registerAgent(dto);
  }
}
