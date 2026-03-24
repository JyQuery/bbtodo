import { generateKeyPairSync } from "node:crypto";

import jwt from "@fastify/jwt";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import {
  createJwksSecretResolver,
  resolveOidcDiscoveryDocument
} from "./oidc.js";

const createdApps: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  while (createdApps.length > 0) {
    const app = createdApps.pop();
    if (app) {
      await app.close();
    }
  }
});

async function createOidcMetadataServer() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048
  });
  const privateKeyPem = privateKey.export({
    format: "pem",
    type: "pkcs8"
  });
  const publicKeyPem = publicKey.export({
    format: "pem",
    type: "spki"
  });
  const publicJwk = publicKey.export({
    format: "jwk"
  }) as JsonWebKey;

  const metadataApp = Fastify();
  createdApps.push(metadataApp);

  let issuerUrl = "";
  metadataApp.get("/.well-known/openid-configuration", async () => ({
    issuer: issuerUrl,
    jwks_uri: `${issuerUrl}/.well-known/jwks.json`
  }));
  metadataApp.get("/.well-known/jwks.json", async () => ({
    keys: [
      {
        ...publicJwk,
        alg: "RS256",
        kid: "test-key",
        use: "sig"
      }
    ]
  }));

  issuerUrl = await metadataApp.listen({
    host: "127.0.0.1",
    port: 0
  });

  return {
    issuerUrl,
    privateKeyPem,
    publicKeyPem
  };
}

describe("OIDC helpers", () => {
  it(
    "resolves discovery metadata and verifies a JWKS-backed id_token",
    async () => {
    const metadataServer = await createOidcMetadataServer();

    const discoveryDocument = await resolveOidcDiscoveryDocument(
      metadataServer.issuerUrl
    );
    expect(discoveryDocument).toEqual({
      issuer: metadataServer.issuerUrl.endsWith("/")
        ? metadataServer.issuerUrl
        : `${metadataServer.issuerUrl}/`,
      jwksUri: `${metadataServer.issuerUrl}/.well-known/jwks.json`
    });

    const signerApp = Fastify();
    createdApps.push(signerApp);
    await signerApp.register(jwt as never, {
      secret: {
        private: metadataServer.privateKeyPem,
        public: metadataServer.publicKeyPem
      }
    } as never);
    await signerApp.ready();

    const validIdToken = signerApp.jwt.sign(
      {
        email: "jwks@example.com",
        name: "JWKS User",
        nonce: "expected-nonce"
      },
      {
        algorithm: "RS256",
        aud: "bbtodo-test",
        expiresIn: "1h",
        header: {
          alg: "RS256",
          kid: "test-key"
        },
        iss: discoveryDocument.issuer,
        sub: "jwks-user"
      }
    );

    const verifierApp = Fastify();
    createdApps.push(verifierApp);
    await verifierApp.register(jwt as never, {
      decode: {
        complete: true
      },
      secret: createJwksSecretResolver({
        clientSecret: "top-secret",
        jwksUri: discoveryDocument.jwksUri
      }),
      verify: {
        allowedAud: "bbtodo-test",
        allowedIss: discoveryDocument.issuer
      }
    } as never);
    await verifierApp.ready();

    await expect(
      Promise.resolve(
        verifierApp.jwt.verify<{
          email: string;
          name: string;
          nonce: string;
          sub: string;
        }>(validIdToken)
      )
    ).resolves.toMatchObject({
      email: "jwks@example.com",
      name: "JWKS User",
      nonce: "expected-nonce",
      sub: "jwks-user"
    });
    },
    15_000
  );

  it(
    "rejects an id_token signed by a key that is not in JWKS",
    async () => {
    const metadataServer = await createOidcMetadataServer();

    const signerApp = Fastify();
    createdApps.push(signerApp);
    const unrelatedKeys = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });
    const unrelatedPrivateKeyPem = unrelatedKeys.privateKey.export({
      format: "pem",
      type: "pkcs8"
    });
    const unrelatedPublicKeyPem = unrelatedKeys.publicKey.export({
      format: "pem",
      type: "spki"
    });

    await signerApp.register(jwt as never, {
      secret: {
        private: unrelatedPrivateKeyPem,
        public: unrelatedPublicKeyPem
      }
    } as never);
    await signerApp.ready();

    const invalidIdToken = signerApp.jwt.sign(
      {
        nonce: "expected-nonce"
      },
      {
        algorithm: "RS256",
        aud: "bbtodo-test",
        expiresIn: "1h",
        header: {
          alg: "RS256",
          kid: "unknown-key"
        },
        iss: `${metadataServer.issuerUrl}/`,
        sub: "jwks-user"
      }
    );

    const verifierApp = Fastify();
    createdApps.push(verifierApp);
    await verifierApp.register(jwt as never, {
      decode: {
        complete: true
      },
      secret: createJwksSecretResolver({
        clientSecret: "top-secret",
        jwksUri: `${metadataServer.issuerUrl}/.well-known/jwks.json`
      }),
      verify: {
        allowedAud: "bbtodo-test",
        allowedIss: `${metadataServer.issuerUrl}/`
      }
    } as never);
    await verifierApp.ready();

    await expect(
      Promise.resolve().then(() => verifierApp.jwt.verify(invalidIdToken))
    ).rejects.toThrow();
    },
    15_000
  );
});
