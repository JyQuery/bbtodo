import { createPublicKey } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AppConfig } from "./config.js";

export const OIDC_NONCE_COOKIE = "bbtodo_oidc_nonce";
export const OIDC_STATE_COOKIE = "bbtodo_oidc_state";
export const OIDC_VERIFIER_COOKIE = "bbtodo_oidc_verifier";
export const OIDC_OAUTH_NAMESPACE = "oidcOAuth2";

const oidcDiscoverySchema = z.object({
  issuer: z.url(),
  jwks_uri: z.url()
});

const oidcJwksSchema = z.object({
  keys: z.array(z.record(z.string(), z.unknown()))
});

const oidcIdTokenClaimsSchema = z.object({
  aud: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  azp: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  iss: z.url(),
  name: z.string().min(1).optional(),
  nonce: z.string().min(1).optional(),
  preferred_username: z.string().min(1).optional(),
  sub: z.string().min(1)
});

export interface AuthenticatedIdentity {
  issuer: string;
  subject: string;
  email: string | null;
  displayName: string | null;
}

export interface OidcDiscoveryDocument {
  issuer: string;
  jwksUri: string;
}

export interface OidcOAuth2Namespace {
  generateAuthorizationUri(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<string>;
  getAccessTokenFromAuthorizationCodeFlow(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<{
    token: {
      access_token: string;
      id_token?: string;
    };
  }>;
}

export interface JwtVerifier {
  verify(token: string): unknown | Promise<unknown>;
}

export interface OidcAuthTestingOptions {
  discoveryDocument?: OidcDiscoveryDocument;
  jwtVerifier?: JwtVerifier;
  onAuthorizationNonce?: (nonce: string) => void;
  oauth2Namespace?: OidcOAuth2Namespace;
}

interface DecodedJwtHeaderLike {
  alg?: string;
  kid?: string;
}

interface DecodedJwtLike extends DecodedJwtHeaderLike {
  header?: {
    alg?: string;
    kid?: string;
  };
}

export function normalizeIssuer(issuer: string) {
  return new URL(issuer).toString();
}

export function getOidcDiscoveryUrl(issuer: string) {
  const normalizedIssuer = normalizeIssuer(issuer).replace(/\/$/, "");
  return `${normalizedIssuer}/.well-known/openid-configuration`;
}

export async function resolveOidcDiscoveryDocument(
  issuer: string,
  fetchFn: typeof fetch = fetch
): Promise<OidcDiscoveryDocument> {
  const discoveryUrl = getOidcDiscoveryUrl(issuer);
  const response = await fetchFn(discoveryUrl, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `OIDC discovery failed with status ${response.status} for ${discoveryUrl}.`
    );
  }

  const parsed = oidcDiscoverySchema.parse(await response.json());
  return {
    issuer: normalizeIssuer(parsed.issuer),
    jwksUri: parsed.jwks_uri
  };
}

async function resolveJwksPublicKeyPem(
  jwksUri: string,
  alg: string,
  kid: string,
  cache: Map<string, string>,
  fetchFn: typeof fetch
) {
  const cacheKey = `${alg}:${kid}:${jwksUri}`;
  const cachedKey = cache.get(cacheKey);
  if (cachedKey) {
    return cachedKey;
  }

  const response = await fetchFn(jwksUri, {
    headers: {
      accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(
      `OIDC JWKS fetch failed with status ${response.status} for ${jwksUri}.`
    );
  }

  const jwks = oidcJwksSchema.parse(await response.json());
  const jwk = jwks.keys.find(
    (entry) =>
      typeof entry.kid === "string" &&
      entry.kid === kid &&
      (typeof entry.alg !== "string" || entry.alg === alg)
  );
  if (!jwk) {
    throw new Error(`OIDC JWKS did not contain a signing key for kid ${kid}.`);
  }

  const publicKey = createPublicKey({
    format: "jwk",
    key: jwk as JsonWebKey
  });
  const pemString = publicKey
    .export({
      format: "pem",
      type: "spki"
    })
    .toString();

  cache.set(cacheKey, pemString);
  return pemString;
}

export function createJwksSecretResolver(
  options: {
    clientSecret: string;
    jwksUri: string;
    fetchFn?: typeof fetch;
  }
) {
  const cache = new Map<string, string>();
  const fetchFn = options.fetchFn ?? fetch;

  return async (tokenOrHeader: DecodedJwtLike) => {
    const header = tokenOrHeader.header ?? tokenOrHeader;
    const alg = header.alg;
    if (!alg) {
      throw new Error("OIDC id_token header did not include an algorithm.");
    }

    if (alg.startsWith("HS")) {
      return options.clientSecret;
    }

    const kid = header.kid;
    if (!kid) {
      throw new Error("OIDC id_token header did not include a key id.");
    }

    return resolveJwksPublicKeyPem(
      options.jwksUri,
      alg,
      kid,
      cache,
      fetchFn
    );
  };
}

export function createOidcNonce() {
  return crypto.randomUUID();
}

export function buildAuthorizationRedirectUrl(
  authorizationUri: string,
  nonce: string
) {
  const redirectUrl = new URL(authorizationUri);
  redirectUrl.searchParams.set("nonce", nonce);
  return redirectUrl.toString();
}

export function buildAuthenticatedIdentity(
  config: AppConfig,
  verifiedClaims: unknown,
  expectedNonce: string
): AuthenticatedIdentity {
  const claims = oidcIdTokenClaimsSchema.parse(verifiedClaims);
  const normalizedIssuer = normalizeIssuer(config.oidcIssuer);

  if (normalizeIssuer(claims.iss) !== normalizedIssuer) {
    throw new Error("OIDC id_token issuer did not match the configured issuer.");
  }

  const audienceValues = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audienceValues.includes(config.oidcClientId)) {
    throw new Error("OIDC id_token audience did not include the configured client.");
  }

  if (audienceValues.length > 1 && claims.azp !== config.oidcClientId) {
    throw new Error("OIDC id_token azp claim did not match the configured client.");
  }

  if (claims.nonce !== expectedNonce) {
    throw new Error("OIDC id_token nonce did not match the login request.");
  }

  return {
    issuer: normalizedIssuer,
    subject: claims.sub,
    email: claims.email ?? null,
    displayName: claims.name ?? claims.preferred_username ?? null
  };
}
