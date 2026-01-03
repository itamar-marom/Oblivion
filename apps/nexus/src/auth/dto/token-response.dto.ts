/**
 * OAuth2 Token response.
 *
 * Returned after successful authentication:
 *   {
 *     "access_token": "eyJhbGc...",
 *     "token_type": "Bearer",
 *     "expires_in": 3600
 *   }
 */
export class TokenResponseDto {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
}
