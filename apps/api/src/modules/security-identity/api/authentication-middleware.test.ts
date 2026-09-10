import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import Fastify from "fastify";

import { db } from "../../../infrastructure/database/pool.js";
import {
  createSession,
} from "../infrastructure/session-repository.js";
import {
  revokeSession,
} from "../infrastructure/session-repository.js";
import {
  hashSessionToken,
} from "../security/session-credential.js";
import {
  hashPassword,
} from "../security/password-hasher.js";
import {
  authenticationMiddleware,
} from "./authentication-middleware.js";

const createTestApp = () => {
  const app = Fastify();

  app.decorateRequest(
    "authenticatedContext",
    null,
  );

  app.get(
    "/protected",
    {
      preHandler:
        authenticationMiddleware,
    },
    async (request) => {
      return {
        authenticated: true,
        sessionId:
          request.authenticatedContext
            ?.sessionId,
        userId:
          request.authenticatedContext
            ?.user.userId,
        companyId:
          request.authenticatedContext
            ?.company.id,
      };
    },
  );

  return app;
};

test("Authentication Middleware", async (t) => {
  const suffix =
    randomUUID().slice(0, 8);

  let userId: string | null = null;
  let organizationId: string | null = null;
  let companyId: string | null = null;
  let roleId: string | null = null;
  let permissionId: string | null = null;
  let sessionId: string | null = null;

  const email =
    `middleware-test-${suffix}@enterprisex.local`;

  const cleanup = async (): Promise<void> => {
    if (sessionId) {
      await db.query(
        `
          DELETE FROM security.sessions
          WHERE id = $1
        `,
        [sessionId],
      );
    }

    if (userId) {
      await db.query(
        `
          DELETE FROM core.audit_events
          WHERE actor_user_id = $1
        `,
        [userId],
      );

      await db.query(
        `
          DELETE FROM security.user_roles
          WHERE user_id = $1
        `,
        [userId],
      );

      await db.query(
        `
          DELETE FROM security.user_company_access
          WHERE user_id = $1
        `,
        [userId],
      );

      await db.query(
        `
          DELETE FROM security.user_credentials
          WHERE user_id = $1
        `,
        [userId],
      );

      await db.query(
        `
          DELETE FROM security.users
          WHERE id = $1
        `,
        [userId],
      );
    }

    if (roleId) {
      await db.query(
        `
          DELETE FROM security.role_permissions
          WHERE role_id = $1
        `,
        [roleId],
      );

      await db.query(
        `
          DELETE FROM security.roles
          WHERE id = $1
        `,
        [roleId],
      );
    }

    if (permissionId) {
      await db.query(
        `
          DELETE FROM security.permissions
          WHERE id = $1
        `,
        [permissionId],
      );
    }

    if (companyId) {
      await db.query(
        `
          DELETE FROM core.companies
          WHERE id = $1
        `,
        [companyId],
      );
    }

    if (organizationId) {
      await db.query(
        `
          DELETE FROM core.organizations
          WHERE id = $1
        `,
        [organizationId],
      );
    }
  };

  await t.test(
    "rejects a request without an Authorization header",
    async () => {
      const app =
        createTestApp();

      try {
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
      } finally {
        await app.close();
      }
    },
  );

  await t.test(
    "rejects a malformed Authorization header",
    async () => {
      const app =
        createTestApp();

      try {
        const response =
          await app.inject({
            method: "GET",
            url: "/protected",
            headers: {
              authorization:
                "Basic invalid-token",
            },
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
      } finally {
        await app.close();
      }
    },
  );

  await t.test(
    "rejects an invalid session token",
    async () => {
      const app =
        createTestApp();

      try {
        const response =
          await app.inject({
            method: "GET",
            url: "/protected",
            headers: {
              authorization:
                "Bearer invalid-session-token",
            },
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
      } finally {
        await app.close();
      }
    },
  );

  await t.test(
    "attaches authenticated context for a valid session",
    async () => {
      try {
        /*
         * Organization
         */
        const organizationResult =
          await db.query<{ id: string }>(
            `
              INSERT INTO core.organizations (
                code,
                name,
                status
              )
              VALUES (
                $1,
                $2,
                'ACTIVE'
              )
              RETURNING id
            `,
            [
              `MW-ORG-${suffix}`,
              "Middleware Test Organization",
            ],
          );

        organizationId =
          organizationResult.rows[0].id;

        /*
         * Company
         */
        const companyResult =
          await db.query<{ id: string }>(
            `
              INSERT INTO core.companies (
                organization_id,
                code,
                name,
                status
              )
              VALUES (
                $1,
                $2,
                $3,
                'ACTIVE'
              )
              RETURNING id
            `,
            [
              organizationId,
              `MW-CO-${suffix}`,
              "Middleware Test Company",
            ],
          );

        companyId =
          companyResult.rows[0].id;

        /*
         * User
         */
        const userResult =
          await db.query<{ id: string }>(
            `
              INSERT INTO security.users (
                email,
                display_name,
                status
              )
              VALUES (
                $1,
                $2,
                'ACTIVE'
              )
              RETURNING id
            `,
            [
              email,
              "Middleware Test User",
            ],
          );

        userId =
          userResult.rows[0].id;

        /*
         * Credentials
         */
        await db.query(
          `
            INSERT INTO security.user_credentials (
              user_id,
              password_hash
            )
            VALUES (
              $1,
              $2
            )
          `,
          [
            userId,
            await hashPassword(
              "Middleware-Test-Password",
            ),
          ],
        );

        /*
         * User → Company Access
         */
        await db.query(
          `
            INSERT INTO security.user_company_access (
              user_id,
              organization_id,
              company_id,
              status
            )
            VALUES (
              $1,
              $2,
              $3,
              'ACTIVE'
            )
          `,
          [
            userId,
            organizationId,
            companyId,
          ],
        );

        /*
         * Permission
         */
        const permissionResult =
          await db.query<{ id: string }>(
            `
              INSERT INTO security.permissions (
                code,
                name
              )
              VALUES (
                $1,
                $2
              )
              RETURNING id
            `,
            [
              `middleware.test.${suffix}`,
              "Middleware Test Permission",
            ],
          );

        permissionId =
          permissionResult.rows[0].id;

        /*
         * Role
         */
        const roleResult =
          await db.query<{ id: string }>(
            `
              INSERT INTO security.roles (
                code,
                name,
                status
              )
              VALUES (
                $1,
                $2,
                'ACTIVE'
              )
              RETURNING id
            `,
            [
              `MW_ROLE_${suffix}`,
              "Middleware Test Role",
            ],
          );

        roleId =
          roleResult.rows[0].id;

        /*
         * Role → Permission
         */
        await db.query(
          `
            INSERT INTO security.role_permissions (
              role_id,
              permission_id
            )
            VALUES (
              $1,
              $2
            )
          `,
          [
            roleId,
            permissionId,
          ],
        );

        /*
         * User → Company-scoped Role
         */
        await db.query(
          `
            INSERT INTO security.user_roles (
              user_id,
              role_id,
              company_id,
              status
            )
            VALUES (
              $1,
              $2,
              $3,
              'ACTIVE'
            )
          `,
          [
            userId,
            roleId,
            companyId,
          ],
        );

        /*
         * Session
         */
        const token =
          `middleware-test-token-${suffix}`;

        const session =
          await createSession({
            userId,
            tokenHash:
              hashSessionToken(token),
            expiresAt:
              new Date(
                Date.now() +
                  60 * 60 * 1000,
              ),
          });

        sessionId =
          session.id;

        const app =
          createTestApp();

        try {
          const response =
            await app.inject({
              method: "GET",
              url: "/protected",
              headers: {
                authorization:
                  `Bearer ${token}`,
              },
            });

          assert.equal(
            response.statusCode,
            200,
          );

          assert.deepEqual(
            response.json(),
            {
              authenticated: true,
              sessionId:
                session.id,
              userId,
              companyId,
            },
          );
        } finally {
          await app.close();
        }
      } finally {
        await cleanup();
      }
    },
  );

  await t.test(
    "rejects a revoked session",
    async () => {
      try {
        const organizationResult =
          await db.query<{ id: string }>(
            `
              INSERT INTO core.organizations (
                code,
                name,
                status
              )
              VALUES (
                $1,
                $2,
                'ACTIVE'
              )
              RETURNING id
            `,
            [
              `MW-REV-ORG-${suffix}`,
              "Middleware Revoked Organization",
            ],
          );

        const revokedOrganizationId =
          organizationResult.rows[0].id;

        const companyResult =
          await db.query<{ id: string }>(
            `
              INSERT INTO core.companies (
                organization_id,
                code,
                name,
                status
              )
              VALUES (
                $1,
                $2,
                $3,
                'ACTIVE'
              )
              RETURNING id
            `,
            [
              revokedOrganizationId,
              `MW-REV-CO-${suffix}`,
              "Middleware Revoked Company",
            ],
          );

        const revokedCompanyId =
          companyResult.rows[0].id;

        const userResult =
          await db.query<{ id: string }>(
            `
              INSERT INTO security.users (
                email,
                display_name,
                status
              )
              VALUES (
                $1,
                $2,
                'ACTIVE'
              )
              RETURNING id
            `,
            [
              `revoked-${suffix}@enterprisex.local`,
              "Middleware Revoked User",
            ],
          );

        const revokedUserId =
          userResult.rows[0].id;

        await db.query(
          `
            INSERT INTO security.user_company_access (
              user_id,
              organization_id,
              company_id,
              status
            )
            VALUES (
              $1,
              $2,
              $3,
              'ACTIVE'
            )
          `,
          [
            revokedUserId,
            revokedOrganizationId,
            revokedCompanyId,
          ],
        );

        const permissionResult =
          await db.query<{ id: string }>(
            `
              INSERT INTO security.permissions (
                code,
                name
              )
              VALUES (
                $1,
                $2
              )
              RETURNING id
            `,
            [
              `middleware.revoked.${suffix}`,
              "Middleware Revoked Permission",
            ],
          );

        const revokedPermissionId =
          permissionResult.rows[0].id;

        const roleResult =
          await db.query<{ id: string }>(
            `
              INSERT INTO security.roles (
                code,
                name,
                status
              )
              VALUES (
                $1,
                $2,
                'ACTIVE'
              )
              RETURNING id
            `,
            [
              `MW_REV_ROLE_${suffix}`,
              "Middleware Revoked Role",
            ],
          );

        const revokedRoleId =
          roleResult.rows[0].id;

        await db.query(
          `
            INSERT INTO security.role_permissions (
              role_id,
              permission_id
            )
            VALUES ($1, $2)
          `,
          [
            revokedRoleId,
            revokedPermissionId,
          ],
        );

        await db.query(
          `
            INSERT INTO security.user_roles (
              user_id,
              role_id,
              company_id,
              status
            )
            VALUES (
              $1,
              $2,
              $3,
              'ACTIVE'
            )
          `,
          [
            revokedUserId,
            revokedRoleId,
            revokedCompanyId,
          ],
        );

        const token =
          `revoked-test-token-${suffix}`;

        const session =
          await createSession({
            userId: revokedUserId,
            tokenHash:
              hashSessionToken(token),
            expiresAt:
              new Date(
                Date.now() +
                  60 * 60 * 1000,
              ),
          });

        await revokeSession(
          session.id,
        );

        const app =
          createTestApp();

        try {
          const response =
            await app.inject({
              method: "GET",
              url: "/protected",
              headers: {
                authorization:
                  `Bearer ${token}`,
              },
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
        } finally {
          await app.close();
        }

        await db.query(
          `
            DELETE FROM security.sessions
            WHERE id = $1
          `,
          [session.id],
        );

        await db.query(
          `
            DELETE FROM security.user_roles
            WHERE user_id = $1
          `,
          [revokedUserId],
        );

        await db.query(
          `
            DELETE FROM security.user_company_access
            WHERE user_id = $1
          `,
          [revokedUserId],
        );

        await db.query(
          `
            DELETE FROM security.user_credentials
            WHERE user_id = $1
          `,
          [revokedUserId],
        );

        await db.query(
          `
            DELETE FROM security.users
            WHERE id = $1
          `,
          [revokedUserId],
        );

        await db.query(
          `
            DELETE FROM security.role_permissions
            WHERE role_id = $1
          `,
          [revokedRoleId],
        );

        await db.query(
          `
            DELETE FROM security.roles
            WHERE id = $1
          `,
          [revokedRoleId],
        );

        await db.query(
          `
            DELETE FROM security.permissions
            WHERE id = $1
          `,
          [revokedPermissionId],
        );

        await db.query(
          `
            DELETE FROM core.companies
            WHERE id = $1
          `,
          [revokedCompanyId],
        );

        await db.query(
          `
            DELETE FROM core.organizations
            WHERE id = $1
          `,
          [revokedOrganizationId],
        );
      } finally {
        await cleanup();
      }
    },
  );

  await db.end();
});