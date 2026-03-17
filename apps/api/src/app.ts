import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { z } from "zod";

import type { AppConfig } from "./config.js";
import { createDatabase, createSession, deleteSession, getUserForSession, upsertUser } from "./db.js";
import { authFlowStateSchema, createOidcProvider, type OidcProvider } from "./oidc.js";

const AUTH_FLOW_COOKIE = "bbtodo_oidc";
const SESSION_COOKIE = "bbtodo_session";
const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1)
});

function isSecureCookie(publicOrigin: string) {
  return new URL(publicOrigin).protocol === "https:";
}

function parseSignedCookie(
  app: ReturnType<typeof Fastify>,
  rawCookieValue: string | undefined,
  schema: typeof authFlowStateSchema
) {
  if (!rawCookieValue) {
    return null;
  }

  const unsigned = app.unsignCookie(rawCookieValue);
  if (!unsigned.valid) {
    return null;
  }

  return schema.parse(JSON.parse(unsigned.value));
}

function getSignedSessionId(
  app: ReturnType<typeof Fastify>,
  rawCookieValue: string | undefined
) {
  if (!rawCookieValue) {
    return null;
  }

  const unsigned = app.unsignCookie(rawCookieValue);
  return unsigned.valid ? unsigned.value : null;
}

export function buildApp(options: {
  config: AppConfig;
  oidcProvider?: OidcProvider;
}) {
  const app = Fastify({
    logger: true
  });
  const database = createDatabase(options.config.sqlitePath);
  const oidcProvider = options.oidcProvider ?? createOidcProvider(options.config);
  const secureCookie = isSecureCookie(options.config.publicOrigin);

  app.register(cookie, {
    secret: options.config.sessionSecret
  });

  app.get("/health", async () => {
    return {
      app: "bbtodo-api",
      status: "ok"
    };
  });

  app.get("/auth/login", async (_request, reply) => {
    const loginRequest = await oidcProvider.createLoginRequest();
    reply.setCookie(AUTH_FLOW_COOKIE, JSON.stringify(loginRequest.flowState), {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/auth",
      sameSite: "lax",
      secure: secureCookie,
      signed: true
    });

    return reply.redirect(loginRequest.redirectUrl);
  });

  app.get("/auth/callback", async (request, reply) => {
    const callbackQuery = callbackQuerySchema.parse(request.query);
    const flowState = parseSignedCookie(
      app,
      request.cookies[AUTH_FLOW_COOKIE],
      authFlowStateSchema
    );

    if (!flowState) {
      return reply.status(400).send({
        message: "Missing or invalid OIDC flow cookie."
      });
    }

    const callbackUrl = new URL(
      `${options.config.publicOrigin}/auth/callback?code=${encodeURIComponent(callbackQuery.code)}&state=${encodeURIComponent(callbackQuery.state)}`
    );
    const identity = await oidcProvider.completeLogin(callbackUrl, flowState);
    const user = await upsertUser(database.db, identity);
    const expiresAt = new Date(
      Date.now() + options.config.sessionTtlHours * 60 * 60 * 1000
    ).toISOString();
    const session = createSession(database.db, {
      userId: user.id,
      expiresAt
    });

    reply.clearCookie(AUTH_FLOW_COOKIE, {
      path: "/auth"
    });
    reply.setCookie(SESSION_COOKIE, session.id, {
      expires: new Date(expiresAt),
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: secureCookie,
      signed: true
    });

    return reply.redirect("/");
  });

  app.post("/auth/logout", async (request, reply) => {
    const sessionId = getSignedSessionId(app, request.cookies[SESSION_COOKIE]);
    if (sessionId) {
      deleteSession(database.db, sessionId);
    }

    reply.clearCookie(SESSION_COOKIE, {
      path: "/"
    });

    return reply.status(204).send();
  });

  app.get("/api/v1/me", async (request, reply) => {
    const sessionId = getSignedSessionId(app, request.cookies[SESSION_COOKIE]);
    if (!sessionId) {
      return reply.status(401).send({
        message: "Authentication required."
      });
    }

    const user = getUserForSession(database.db, sessionId);
    if (!user) {
      reply.clearCookie(SESSION_COOKIE, {
        path: "/"
      });

      return reply.status(401).send({
        message: "Authentication required."
      });
    }

    return {
      email: user.email,
      id: user.id,
      name: user.displayName
    };
  });

  app.addHook("onClose", async () => {
    database.database.close();
  });

  return app;
}
