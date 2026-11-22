import { google } from "googleapis";

export type GoogleIdentity = {
  email: string;
  emailVerified: boolean;
};

/**
 * Google is only used to prove who is connecting (openid + email).
 * Jotly then issues its own tokens to the MCP client.
 */
export type GoogleIdentityProvider = {
  buildAuthUrl(input: { state: string; codeChallenge: string }): string;
  exchangeCode(input: { code: string; codeVerifier: string }): Promise<GoogleIdentity>;
};

export function createGoogleIdentityProvider(options: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): GoogleIdentityProvider {
  const newClient = () => new google.auth.OAuth2(options.clientId, options.clientSecret, options.redirectUri);

  return {
    buildAuthUrl({ state, codeChallenge }) {
      return newClient().generateAuthUrl({
        scope: ["openid", "email"],
        state,
        code_challenge: codeChallenge,
        // google-auth-library types the method as an enum; "S256" is its value.
        code_challenge_method: "S256" as never,
        prompt: "select_account",
        access_type: "online",
      });
    },

    async exchangeCode({ code, codeVerifier }) {
      const client = newClient();
      const { tokens } = await client.getToken({ code, codeVerifier });
      if (!tokens.id_token) {
        throw new Error("Google did not return an id_token");
      }
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: options.clientId });
      const payload = ticket.getPayload();
      return {
        email: (payload?.email ?? "").toLowerCase(),
        emailVerified: payload?.email_verified === true,
      };
    },
  };
}
