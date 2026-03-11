import { google } from "googleapis";
import type { OAuth2Client, Credentials } from "google-auth-library";

export type GoogleOAuth2ClientFactoryOptions = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleOAuth2ClientFactory = {
  /** Bare client for auth URL generation and code exchange */
  createClient(): OAuth2Client;
  /** Client pre-loaded with decrypted tokens for API calls */
  createClientWithTokens(credentials: Credentials): OAuth2Client;
};

export function createGoogleOAuth2ClientFactory(
  options: GoogleOAuth2ClientFactoryOptions
): GoogleOAuth2ClientFactory {
  const { clientId, clientSecret, redirectUri } = options;

  return {
    createClient() {
      return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    },

    createClientWithTokens(credentials) {
      const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      client.setCredentials(credentials);
      return client;
    },
  };
}
