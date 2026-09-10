import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { db } from "../../../infrastructure/database/pool.js";
import { createSession } from "./session-repository.js";
import { hashSessionToken } from "../security/session-credential.js";
import {
  findAuthenticatedContextBySessionId,
} from "./authenticated-context-repository.js";

test("Authenticated Context Repository", async (t) => {
  const suffix = randomUUID().slice(0, 8);

  let userId: string | null = null;
  let roleId: string | null = null;
  let permissionId: string | null = null;
  let organizationId: string | null = null;
  let companyId: string | null = null;
  let sessionId: string | null = null;

  const email =
    `context-test-${suffix}@enterprisex.local`;

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
    "resolves session, user, company, organization, roles, and permissions",
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
              `CTX-ORG-${suffix}`,
              "Context Test Organization",
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
              `CTX-CO-${suffix}`,
              "Context Test Company",
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
              "Context Test User",
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
         * Permission
         *
         * The actual permissions table does not
         * contain a status column.
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
              `context.test.${suffix}`,
              "Context Test Permission",
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
              `CTX_ROLE_${suffix}`,
              "Context Test Role",
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
         * User → Role → Company
         *
         * user_roles is company-scoped in the
         * actual EnterpriseX authorization schema.
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
          `context-test-token-${suffix}`;

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
         * Resolve authenticated context
         */
        const context =
          await findAuthenticatedContextBySessionId(
            session.id,
          );

        /*
         * Context must exist
         */
        assert.ok(context);

        /*
         * Session
         */
        assert.equal(
          context.sessionId,
          session.id,
        );

        /*
         * User
         */
        assert.equal(
          context.user.userId,
          userId,
        );

        assert.equal(
          context.user.email,
          email,
        );

        assert.equal(
          context.user.displayName,
          "Context Test User",
        );

        /*
         * Organization
         */
        assert.equal(
          context.organization.id,
          organizationId,
        );

        assert.equal(
          context.organization.code,
          `CTX-ORG-${suffix}`,
        );

        assert.equal(
          context.organization.name,
          "Context Test Organization",
        );

        /*
         * Company
         */
        assert.equal(
          context.company.id,
          companyId,
        );

        assert.equal(
          context.company.code,
          `CTX-CO-${suffix}`,
        );

        assert.equal(
          context.company.name,
          "Context Test Company",
        );

        /*
         * Role
         */
        assert.equal(
          context.roles.length,
          1,
        );

        assert.equal(
          context.roles[0].id,
          roleId,
        );

        assert.equal(
          context.roles[0].code,
          `CTX_ROLE_${suffix}`,
        );

        assert.equal(
          context.roles[0].name,
          "Context Test Role",
        );

        /*
         * Permission
         */
        assert.equal(
          context.permissions.length,
          1,
        );

        assert.equal(
          context.permissions[0].code,
          `context.test.${suffix}`,
        );

        assert.equal(
          context.permissions[0].name,
          "Context Test Permission",
        );
      } finally {
        await cleanup();
      }
    },
  );

  await t.test(
    "returns null for an unknown session",
    async () => {
      const context =
        await findAuthenticatedContextBySessionId(
          randomUUID(),
        );

      assert.equal(
        context,
        null,
      );
    },
  );

  await db.end();
});