import { IsString, IsNotEmpty } from 'class-validator';

/**
 * OAuth2 Client Credentials request body.
 *
 * Agents authenticate by sending:
 *   POST /auth/token
 *   { "client_id": "...", "client_secret": "..." }
 */
export class TokenRequestDto {
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsString()
  @IsNotEmpty()
  client_secret: string;
}
