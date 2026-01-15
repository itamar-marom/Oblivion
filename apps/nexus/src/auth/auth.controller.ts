import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { TokenRequestDto } from './dto/token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { RegisterAgentDto } from './dto/register-agent.dto';

/**
 * Authentication Controller.
 *
 * Implements OAuth2 Client Credentials flow for agent authentication.
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get access token',
    description:
      'Exchange client credentials for a JWT access token. ' +
      'Use this token in the Authorization header for all protected endpoints.',
  })
  @ApiBody({ type: TokenRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Token issued successfully',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async token(@Body() dto: TokenRequestDto): Promise<TokenResponseDto> {
    return this.authService.validateAndIssueToken(dto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new agent',
    description:
      'Register a new agent using a registration token. ' +
      'The registration token is obtained from an admin via the Observer dashboard. ' +
      'After registration, the agent will be in PENDING status until approved.',
  })
  @ApiBody({ type: RegisterAgentDto })
  @ApiResponse({
    status: 201,
    description: 'Agent registered successfully (pending approval)',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid registration token or validation error',
  })
  async register(@Body() dto: RegisterAgentDto) {
    return this.authService.registerAgent(dto);
  }
}
