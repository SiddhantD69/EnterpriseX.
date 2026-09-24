import test from "node:test";
import assert from "node:assert/strict";

import {
  buildApp,
} from "../../../app.js";

import {
  db,
} from "../../../infrastructure/database/pool.js";

import {
  hashPassword,
} from "../../security-identity/security/password-hasher.js";

const TEST_EMAIL =
  "core-context-test@enterprisex.local";

const TEST_PASSWORD =
  "EnterpriseXCoreContext@123";

test(
  "returns the authenticated user's ERP context",
  async () => {
    const app = buildApp();

    try {
      /*
       * ---------------------------------------------------------
       * 1. Get an existing organization/company
       * ---------------------------------------------------------
       */

      const companyResult =
        await db.query<{
          organization_id: string;
          company_id: string;
        }>(
          `
            SELECT
              o.id AS organization_id,
              c.id AS company_id
            FROM core.organizations o
            INNER JOIN core.companies c
              ON c.organization_id = o.id
            WHERE o.status = 'ACTIVE'
              AND c.status = 'ACTIVE'
            ORDER BY o.created_at
            LIMIT 1
          `,
        );

      assert.equal(
        companyResult.rowCount,
        1,
        "A seeded active organization/company is required.",
      );

      const organizationId =
        companyResult.rows[0].organization_id;

      const companyId =
        companyResult.rows[0].company_id;

      /*
       * ---------------------------------------------------------
       * 2. Get ERP_ADMIN role
       * ---------------------------------------------------------
       */

      const roleResult =
        await db.query<{
          id: string;
        }>(
          `
            SELECT id
            FROM security.roles
            WHERE code = 'ERP_ADMIN'
            LIMIT 1
          `,
        );

      assert.equal(
        roleResult.rowCount,
        1,
        "ERP_ADMIN role is required.",
      );

      const roleId =
        roleResult.rows[0].id;

      /*
       * ---------------------------------------------------------
       * 3. Get required permission
       * ---------------------------------------------------------
       *
       * Migration 011 already creates this permission.
       *
       * IMPORTANT:
       * Do NOT INSERT it again.
       */

      const permissionResult =
        await db.query<{
          id: string;
          code: string;
          name: string;
        }>(
          `
            SELECT
              id,
              code,
              name
            FROM security.permissions
            WHERE code = 'core.organization.read'
            LIMIT 1
          `,
        );

      assert.equal(
        permissionResult.rowCount,
        1,
        "core.organization.read permission is required.",
      );

      const permissionId =
        permissionResult.rows[0].id;

      /*
       * ---------------------------------------------------------
       * 4. Ensure ERP_ADMIN has the permission
       * ---------------------------------------------------------
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
          ON CONFLICT DO NOTHING
        `,
        [
          roleId,
          permissionId,
        ],
      );

      /*
       * ---------------------------------------------------------
       * 5. Create/find test user
       * ---------------------------------------------------------
       */

      const userResult =
        await db.query<{
          id: string;
        }>(
          `
            SELECT id
            FROM security.users
            WHERE email = $1
            LIMIT 1
          `,
          [
            TEST_EMAIL,
          ],
        );

      let userId: string;

      if (
        userResult.rowCount &&
        userResult.rowCount > 0
      ) {
        userId =
          userResult.rows[0].id;

        await db.query(
          `
            UPDATE security.users
            SET
              display_name = $1,
              status = 'ACTIVE',
              updated_at = NOW()
            WHERE id = $2
          `,
          [
            "Core Context Test User",
            userId,
          ],
        );
      } else {
        const inserted =
          await db.query<{
            id: string;
          }>(
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
              TEST_EMAIL,
              "Core Context Test User",
            ],
          );

        userId =
          inserted.rows[0].id;
      }

      /*
       * ---------------------------------------------------------
       * 6. Set password
       * ---------------------------------------------------------
       */

      const passwordHash =
        await hashPassword(
          TEST_PASSWORD,
        );

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
          ON CONFLICT (user_id)
          DO UPDATE SET
            password_hash =
              EXCLUDED.password_hash,
            updated_at = NOW()
        `,
        [
          userId,
          passwordHash,
        ],
      );

      /*
       * ---------------------------------------------------------
       * 7. Give user access to the company
       * ---------------------------------------------------------
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
          ON CONFLICT DO NOTHING
        `,
        [
          userId,
          organizationId,
          companyId,
        ],
      );

      /*
       * ---------------------------------------------------------
       * 8. Assign ERP_ADMIN to this COMPANY
       * ---------------------------------------------------------
       *
       * user_roles.company_id is NOT NULL.
       *
       * This is why the previous version failed with:
       *
       *   null value in column "company_id"
       *
       * We explicitly provide company_id here.
       */

      const existingUserRole =
        await db.query<{
          id: string;
        }>(
          `
            SELECT id
            FROM security.user_roles
            WHERE
              user_id = $1
              AND role_id = $2
              AND company_id = $3
            LIMIT 1
          `,
          [
            userId,
            roleId,
            companyId,
          ],
        );

      if (
        !existingUserRole.rowCount ||
        existingUserRole.rowCount === 0
      ) {
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
      } else {
        await db.query(
          `
            UPDATE security.user_roles
            SET
              status = 'ACTIVE',
              updated_at = NOW()
            WHERE id = $1
          `,
          [
            existingUserRole.rows[0].id,
          ],
        );
      }

      /*
       * ---------------------------------------------------------
       * 9. Login
       * ---------------------------------------------------------
       */

      const loginResponse =
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: {
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
          },
        });

      assert.equal(
        loginResponse.statusCode,
        200,
        loginResponse.body,
      );

      const loginBody =
        loginResponse.json();

      assert.ok(
        loginBody.session?.token,
        "Login response must contain a session token.",
      );

      const token =
        loginBody.session.token;

      /*
       * ---------------------------------------------------------
       * 10. Request Core Context
       * ---------------------------------------------------------
       */

      const contextResponse =
        await app.inject({
          method: "GET",
          url: "/api/v1/core/context",
          headers: {
            authorization:
              `Bearer ${token}`,
          },
        });

      /*
       * If this fails, print the actual API response.
       * This makes the next failure immediately useful.
       */

      assert.equal(
        contextResponse.statusCode,
        200,
        contextResponse.body,
      );

      const contextBody =
        contextResponse.json();

      /*
       * ---------------------------------------------------------
       * 11. IMPORTANT:
       *     The route returns the context directly.
       *
       *     Expected:
       *
       *     {
       *       user: {...},
       *       organization: {...},
       *       company: {...},
       *       roles: [...],
       *       permissions: [...]
       *     }
       *
       *     NOT:
       *
       *     {
       *       status: "ok",
       *       data: {...}
       *     }
       * ---------------------------------------------------------
       */

      assert.ok(
        contextBody,
        "Core context response must contain a body.",
      );

      assert.ok(
        contextBody.user,
        "Core context must contain user.",
      );

      assert.ok(
        contextBody.organization,
        "Core context must contain organization.",
      );

      assert.ok(
        contextBody.company,
        "Core context must contain company.",
      );

      assert.ok(
        Array.isArray(
          contextBody.roles,
        ),
        "Core context roles must be an array.",
      );

      assert.ok(
        Array.isArray(
          contextBody.permissions,
        ),
        "Core context permissions must be an array.",
      );

      /*
       * ---------------------------------------------------------
       * 12. Verify user
       * ---------------------------------------------------------
       */

      assert.equal(
        contextBody.user.email,
        TEST_EMAIL,
      );

      assert.equal(
        contextBody.user.displayName,
        "Core Context Test User",
      );

      /*
       * ---------------------------------------------------------
       * 13. Verify organization
       * ---------------------------------------------------------
       */

      assert.equal(
        contextBody.organization.id,
        organizationId,
      );

      /*
       * ---------------------------------------------------------
       * 14. Verify company
       * ---------------------------------------------------------
       */

      assert.equal(
        contextBody.company.id,
        companyId,
      );

      /*
       * ---------------------------------------------------------
       * 15. Verify ERP_ADMIN role
       * ---------------------------------------------------------
       */

      assert.ok(
        contextBody.roles.some(
          (role: {
            id: string;
            code: string;
          }) =>
            role.id === roleId &&
            role.code === "ERP_ADMIN",
        ),
        "ERP_ADMIN role must be present in the context.",
      );

      /*
       * ---------------------------------------------------------
       * 16. Verify required permission
       * ---------------------------------------------------------
       */

      assert.ok(
        contextBody.permissions.some(
          (permission: {
            code: string;
          }) =>
            permission.code ===
            "core.organization.read",
        ),
        "core.organization.read must be present.",
      );
    } finally {
      await app.close();
    }
  },
);