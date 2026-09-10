import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import Fastify from "fastify";

import { db } from "../../../infrastructure/database/pool.js";
import { createSession } from "../../security-identity/infrastructure/session-repository.js";
import { hashSessionToken } from "../../security-identity/security/session-credential.js";
import { registerCoreContextRoute } from "./core-context-route.js";

const createTestApp = () => {
  const app = Fastify();

  app.decorateRequest(
    "authenticatedContext",
    null,
  );

  registerCoreContextRoute(app);

  return app;
};

test("Core Context API", async (t) => {
  const suffix = randomUUID().slice(0, 8);

  let userId: string | null = null;
  let organizationId: string | null = null;
  let companyId: string | null = null;
  let roleId: string | null = null;
  let permissionId: string | null = null;
  let sessionId: string | null = null;

  const email =
    `core-context-test-${suffix}@enterprisex.local`;

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
    "rejects an unauthenticated request",
    async () => {
      const app = createTestApp();

      try {
        const response = await app.inject({
          method: "GET",
          url: "/api/v1/core/context",
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
    "returns the authenticated user's ERP context",
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
              `CC-ORG-${suffix}`,
              "Core Context Test Organization",
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
              `CC-CO-${suffix}`,
              "Core Context Test Company",
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
              "Core Context Test User",
            ],
          );

        userId =
          userResult.rows[0].id;

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
         * Permission required by the
         * protected Core Context API route.
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
              "core.organization.read",
              "Read organization context",
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
              `CC_ROLE_${suffix}`,
              "Core Context Test Role",
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
          `core-context-test-token-${suffix}`;

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

        /*
         * Call the protected endpoint.
         */
        const app =
          createTestApp();

        try {
          const response =
            await app.inject({
              method: "GET",
              url: "/api/v1/core/context",
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
              user: {
                id: userId,
                email,
                displayName:
                  "Core Context Test User",
              },

              organization: {
                id: organizationId,
                code:
                  `CC-ORG-${suffix}`,
                name:
                  "Core Context Test Organization",
              },

              company: {
                id: companyId,
                code:
                  `CC-CO-${suffix}`,
                name:
                  "Core Context Test Company",
              },

              roles: [
                {
                  id: roleId,
                  code:
                    `CC_ROLE_${suffix}`,
                  name:
                    "Core Context Test Role",
                },
              ],

              permissions: [
                {
                  code:
                    "core.organization.read",
                  name:
                    "Read organization context",
                },
              ],
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
    "does not leak a role assigned to another company",
    async () => {
      const crossCompanySuffix =
        randomUUID().slice(0, 8);

      let crossUserId: string | null = null;
      let crossOrganizationId: string | null = null;
      let companyAId: string | null = null;
      let companyBId: string | null = null;
      let crossRoleId: string | null = null;
      let crossPermissionId: string | null = null;
      let crossSessionId: string | null = null;

      const crossEmail =
        `cross-company-${crossCompanySuffix}@enterprisex.local`;

      const cleanupCrossCompany = async (): Promise<void> => {
        if (crossSessionId) {
          await db.query(
            `
              DELETE FROM security.sessions
              WHERE id = $1
            `,
            [crossSessionId],
          );
        }

        if (crossUserId) {
          await db.query(
            `
              DELETE FROM core.audit_events
              WHERE actor_user_id = $1
            `,
            [crossUserId],
          );

          await db.query(
            `
              DELETE FROM security.user_roles
              WHERE user_id = $1
            `,
            [crossUserId],
          );

          await db.query(
            `
              DELETE FROM security.user_company_access
              WHERE user_id = $1
            `,
            [crossUserId],
          );

          await db.query(
            `
              DELETE FROM security.user_credentials
              WHERE user_id = $1
            `,
            [crossUserId],
          );

          await db.query(
            `
              DELETE FROM security.users
              WHERE id = $1
            `,
            [crossUserId],
          );
        }

        if (crossRoleId) {
          await db.query(
            `
              DELETE FROM security.role_permissions
              WHERE role_id = $1
            `,
            [crossRoleId],
          );

          await db.query(
            `
              DELETE FROM security.roles
              WHERE id = $1
            `,
            [crossRoleId],
          );
        }

        if (crossPermissionId) {
          await db.query(
            `
              DELETE FROM security.permissions
              WHERE id = $1
            `,
            [crossPermissionId],
          );
        }

        if (companyAId || companyBId) {
          const companyIds = [
            companyAId,
            companyBId,
          ].filter(
            (id): id is string => id !== null,
          );

          if (companyIds.length > 0) {
            await db.query(
              `
                DELETE FROM core.companies
                WHERE id = ANY($1::uuid[])
              `,
              [companyIds],
            );
          }
        }

        if (crossOrganizationId) {
          await db.query(
            `
              DELETE FROM core.organizations
              WHERE id = $1
            `,
            [crossOrganizationId],
          );
        }
      };

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
              `XCO-ORG-${crossCompanySuffix}`,
              "Cross Company Test Organization",
            ],
          );

        crossOrganizationId =
          organizationResult.rows[0].id;

        const companyAResult =
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
              crossOrganizationId,
              `XCO-A-${crossCompanySuffix}`,
              "Cross Company Test Company A",
            ],
          );

        companyAId =
          companyAResult.rows[0].id;

        const companyBResult =
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
              crossOrganizationId,
              `XCO-B-${crossCompanySuffix}`,
              "Cross Company Test Company B",
            ],
          );

        companyBId =
          companyBResult.rows[0].id;

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
              crossEmail,
              "Cross Company Test User",
            ],
          );

        crossUserId =
          userResult.rows[0].id;

        /*
         * The user is authorized to access Company B only.
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
            crossUserId,
            crossOrganizationId,
            companyBId,
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
              `cross.company.secret.${crossCompanySuffix}`,
              "Cross Company Secret Permission",
            ],
          );

        crossPermissionId =
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
              `XCO_ROLE_${crossCompanySuffix}`,
              "Company A Only Role",
            ],
          );

        crossRoleId =
          roleResult.rows[0].id;

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
            crossRoleId,
            crossPermissionId,
          ],
        );

        /*
         * The role is assigned to Company A, which the user
         * does not have access to.
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
            crossUserId,
            crossRoleId,
            companyAId,
          ],
        );

        const token =
          `cross-company-test-token-${crossCompanySuffix}`;

        const session =
          await createSession({
            userId: crossUserId,
            tokenHash:
              hashSessionToken(token),
            expiresAt:
              new Date(
                Date.now() +
                  60 * 60 * 1000,
              ),
          });

        crossSessionId =
          session.id;

        const app =
          createTestApp();

        try {
          const response =
            await app.inject({
              method: "GET",
              url: "/api/v1/core/context",
              headers: {
                authorization:
                  `Bearer ${token}`,
              },
            });

          /*
           * The route requires core.organization.read.
           * The user has no role in Company B, so the
           * Company A role must not leak into Company B context.
           */
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
        } finally {
          await app.close();
        }
      } finally {
        await cleanupCrossCompany();
      }
    },
  );

  await db.end();
});