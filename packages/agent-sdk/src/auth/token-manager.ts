/**
 * Token Manager
 *
 * Handles OAuth2 client credentials flow with automatic token refresh.
 */

import type { AuthToken } from '../types/index.js';
import { AuthError } from '../utils/errors.js';
import { authLogger } from '../utils/logger.js';

export interface TokenManagerConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

export class TokenManager {
  private config: TokenManagerConfig;
  private token: AuthToken | null = null;
  private refreshPromise: Promise<AuthToken> | null = null;

  constructor(config: TokenManagerConfig) {
    this.config = config;
  }

  /**
   * Authenticate with Nexus and get JWT token.
   */
  private async authenticate(): Promise<AuthToken> {
    authLogger.debug('Authenticating with Nexus...');

    const response = await fetch(`${this.config.baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      authLogger.error('Authentication failed:', response.status, error);
      throw new AuthError(`Authentication failed: ${response.status} ${error}`, response.status);
    }

    const data = await response.json() as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    const token: AuthToken = {
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      // Refresh 60 seconds before expiry
      expiresAt: Date.now() + (data.expires_in * 1000) - 60000,
    };

    authLogger.debug('Authentication successful, token expires in', data.expires_in, 'seconds');

    return token;
  }

  /**
   * Get a valid token, refreshing if needed.
   * Handles concurrent refresh requests by sharing the promise.
   */
  async getToken(): Promise<string> {
    // If we have a valid token, return it
    if (this.token && Date.now() < this.token.expiresAt) {
      return this.token.accessToken;
    }

    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      const token = await this.refreshPromise;
      return token.accessToken;
    }

    // Start a new refresh
    this.refreshPromise = this.authenticate();

    try {
      this.token = await this.refreshPromise;
      return this.token.accessToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Force a token refresh.
   */
  async refresh(): Promise<string> {
    this.token = null;
    return this.getToken();
  }

  /**
   * Clear the cached token.
   */
  clear(): void {
    this.token = null;
    this.refreshPromise = null;
  }

  /**
   * Check if we have a valid token.
   */
  isAuthenticated(): boolean {
    return !!this.token && Date.now() < this.token.expiresAt;
  }
}
