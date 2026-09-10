import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";

import type {
  AuthenticatedContext,
} from "../domain/authenticated-context.js";

import {
  requireAllPermissions,
  requireAnyPermission,
  requirePermission,
} from "./authorization-middleware.js";

const createContext = (
  permissions: string[],
): AuthenticatedContext => ({
  sessionId:
    "00000000-0000-0000-0000-000000000001",

  user: {
    userId:
      "00000000-0000-0000-0000-000000000002",
    email: "test@enterprisex.local",
    displayName: "Test User",
  },

  organization: {
    id:
      "00000000-0000-0000-0000-000000000003",
    code: "TEST",
    name: "Test Organization",
  },

  company: {
    id:
      "00000000-0000-0000-0000-000000000004",
    code: "TEST-CO",
    name: "Test Company",
  },

  roles: [],

  permissions: permissions.map(
    (code) => ({
      code,
      name: code,
    }),
  ),
});

test(
  "requirePermission returns 401 when authentication context is missing",
  async () => {
    const app = Fastify();

    app.decorateRequest(
      "authenticatedContext",
      null,
    );

    app.get(
      "/protected",
      {
        preHandler: [
          requirePermission(
            "finance.read",
          ),
        ],
      },
      async () => ({
        status: "allowed",
      }),
    );

    const response =
      await app.inject({
        method: "GET",
        url: "/protected",
      });

    assert.equal(
      response.statusCode,
      401,
    );

    assert.deepEqual(
      response.json(),
      {
        error: {
          code:
            "AUTHENTICATION_REQUIRED",
          message:
            "Authentication required.",
        },
      },
    );

    await app.close();
  },
);

test(
  "requirePermission allows request with required permission",
  async () => {
    const app = Fastify();

    app.decorateRequest(
      "authenticatedContext",
      null,
    );

    app.addHook(
      "onRequest",
      async (request) => {
        request.authenticatedContext =
          createContext([
            "finance.read",
          ]);
      },
    );

    app.get(
      "/protected",
      {
        preHandler: [
          requirePermission(
            "finance.read",
          ),
        ],
      },
      async () => ({
        status: "allowed",
      }),
    );

    const response =
      await app.inject({
        method: "GET",
        url: "/protected",
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.json(),
      {
        status: "allowed",
      },
    );

    await app.close();
  },
);

test(
  "requirePermission returns 403 when permission is missing",
  async () => {
    const app = Fastify();

    app.decorateRequest(
      "authenticatedContext",
      null,
    );

    app.addHook(
      "onRequest",
      async (request) => {
        request.authenticatedContext =
          createContext([
            "finance.read",
          ]);
      },
    );

    app.get(
      "/protected",
      {
        preHandler: [
          requirePermission(
            "finance.write",
          ),
        ],
      },
      async () => ({
        status: "allowed",
      }),
    );

    const response =
      await app.inject({
        method: "GET",
        url: "/protected",
      });

    assert.equal(
      response.statusCode,
      403,
    );

    assert.deepEqual(
      response.json(),
      {
        error: {
          code: "FORBIDDEN",
          message: "Forbidden.",
        },
      },
    );

    await app.close();
  },
);

test(
  "requireAnyPermission allows when one permission matches",
  async () => {
    const app = Fastify();

    app.decorateRequest(
      "authenticatedContext",
      null,
    );

    app.addHook(
      "onRequest",
      async (request) => {
        request.authenticatedContext =
          createContext([
            "finance.read",
          ]);
      },
    );

    app.get(
      "/protected",
      {
        preHandler: [
          requireAnyPermission([
            "finance.write",
            "finance.read",
          ]),
        ],
      },
      async () => ({
        status: "allowed",
      }),
    );

    const response =
      await app.inject({
        method: "GET",
        url: "/protected",
      });

    assert.equal(
      response.statusCode,
      200,
    );

    await app.close();
  },
);

test(
  "requireAllPermissions denies when one permission is missing",
  async () => {
    const app = Fastify();

    app.decorateRequest(
      "authenticatedContext",
      null,
    );

    app.addHook(
      "onRequest",
      async (request) => {
        request.authenticatedContext =
          createContext([
            "finance.read",
          ]);
      },
    );

    app.get(
      "/protected",
      {
        preHandler: [
          requireAllPermissions([
            "finance.read",
            "finance.write",
          ]),
        ],
      },
      async () => ({
        status: "allowed",
      }),
    );

    const response =
      await app.inject({
        method: "GET",
        url: "/protected",
      });

    assert.equal(
      response.statusCode,
      403,
    );

    await app.close();
  },
);