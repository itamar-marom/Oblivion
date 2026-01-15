import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * OAuth2 Client Credentials request body.
 */
export class TokenRequestDto {
  @ApiProperty({
    description: 'Agent client ID',
    example: 'my-agent',
  })
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @ApiProperty({
    description: 'Agent client secret',
    example: 'super_secret_123',
  })
  @IsString()
  @IsNotEmpty()
  client_secret: string;
}
