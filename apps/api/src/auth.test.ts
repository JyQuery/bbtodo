import { afterEach, describe, expect, it } from "vitest";

import type { AppConfig } from "./config.js";
import type { OidcProvider } from "./oidc.js";
import { buildApp } from "./app.js";

const testConfig: AppConfig = {
  apiHost: "127.0.0.1",
  apiPort: 3000,
  publicOrigin: "http://localhost:5173",
  sessionSecret: "12345678901234567890123456789012",
  sessionTtlHours: 168,
  sqlitePath: ":memory:",
  oidcIssuer: "https://issuer.example.com",
  oidcClientId: "bbtodo-test",
  oidcClientSecret: "top-secret",
  oidcScopes: "openid profile email"
};

const createdApps: Array<ReturnType<typeof buildApp>> = [];

afterEach(async () => {
  while (createdApps.length > 0) {
    const app = createdApps.pop();
    if (app) {
      await app.close();
    }
  }
});

function createMockOidcProvider(): OidcProvider {
  return {
    async createLoginRequest() {
      return {
        redirectUrl: "https://issuer.example.com/authorize?state=test-state",
        flowState: {
          codeVerifier: "test-code-verifier",
          nonce: "test-nonce",
          state: "test-state"
        }
      };
    },
    async completeLogin(callbackUrl, flowState) {
      expect(callbackUrl.toString()).toBe(
        "http://localhost:5173/auth/callback?code=auth-code&state=test-state"
      );
      expect(flowState).toEqual({
        codeVerifier: "test-code-verifier",
        nonce: "test-nonce",
        state: "test-state"
      });

      return {
        issuer: testConfig.oidcIssuer,
        subject: "user-123",
        email: "hello@example.com",
        displayName: "bbtodo Tester"
      };
    }
  };
}

describe("auth routes", () => {
  it("rejects /api/v1/me without a session", async () => {
    const app = buildApp({
      config: testConfig,
      oidcProvider: createMockOidcProvider()
    });
    createdApps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me"
    });

    expect(response.statusCode).toBe(401);
  });

  it("creates a session after the OIDC callback and clears it on logout", async () => {
    const app = buildApp({
      config: testConfig,
      oidcProvider: createMockOidcProvider()
    });
    createdApps.push(app);

    const loginResponse = await app.inject({
      method: "GET",
      url: "/auth/login"
    });

    expect(loginResponse.statusCode).toBe(302);
    expect(loginResponse.headers.location).toBe(
      "https://issuer.example.com/authorize?state=test-state"
    );

    const transactionCookie = loginResponse.cookies.find(
      (cookie) => cookie.name === "bbtodo_oidc"
    );
    expect(transactionCookie).toBeDefined();

    const callbackResponse = await app.inject({
      method: "GET",
      url: "/auth/callback?code=auth-code&state=test-state",
      cookies: {
        bbtodo_oidc: transactionCookie!.value
      }
    });

    expect(callbackResponse.statusCode).toBe(302);
    expect(callbackResponse.headers.location).toBe("/");

    const sessionCookie = callbackResponse.cookies.find(
      (cookie) => cookie.name === "bbtodo_session"
    );
    expect(sessionCookie).toBeDefined();

    const meResponse = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      cookies: {
        bbtodo_session: sessionCookie!.value
      }
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toMatchObject({
      email: "hello@example.com",
      name: "bbtodo Tester"
    });

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: {
        bbtodo_session: sessionCookie!.value
      }
    });

    expect(logoutResponse.statusCode).toBe(204);

    const afterLogoutResponse = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      cookies: {
        bbtodo_session: sessionCookie!.value
      }
    });

    expect(afterLogoutResponse.statusCode).toBe(401);
  });
});

