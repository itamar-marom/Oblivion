import { ApiProperty } from '@nestjs/swagger';

/**
 * OAuth2 Token response.
 */
export class TokenResponseDto {
  @ApiProperty({
    description: 'JWT access token for API authentication',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: 'Token type (always "Bearer")',
    example: 'Bearer',
  })
  token_type: 'Bearer';

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 3600,
  })
  expires_in: number;
}
