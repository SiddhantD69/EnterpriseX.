# EnterpriseX — Recovery Checkpoint

## Current date
2026-10-14

## Project
- Root: C:\Dev\EnterpriseX
- Branch: master
- Stack: TypeScript, Fastify, React, Vite, Tauri, PostgreSQL, Docker
- Architecture: Modular monolith

## Current implementation milestone
Foundation V1 functional baseline is in place for authentication, company selection, core master data, procurement, inventory, and desktop workspaces.

Latest verified milestone:
- HR foundation is implemented with migration 024 and verified by the focused department/employee workflow regression.
- CRM foundation is implemented with migration 025 and verified by the focused lead/opportunity workflow regression.
- Asset, project, and service management foundation is implemented with migration 026 and verified by the focused asset/project/service workflow regression.
- Secure configuration validation is implemented and verified: production startup now rejects blank or placeholder database credentials, while documented local Docker Compose development defaults remain supported without weakening production safety.
- Company-scoped custom role definitions and permission sets remain enforced through the live migration history.
- Shared system roles remain global and retain their global permission behavior.
- Cross-company custom-role assignment remains rejected by the API and integration tests.
- Manufacturing foundation remains implemented with migration 023 and verified by the focused BOM/production-order regression.

Verified current scope:
- Auth and session lifecycle
- Security and permission model
- Startup credential validation and production-safe configuration checks
- Role and user administration foundation
- Company-scoped custom role policy for role definitions and assignments
- Core platform data for plants, warehouses, and storage locations
- Supplier/material catalog support
- Procurement requisitions, purchase orders, goods receipt, stock balances, stock movements, and invoice matching
- Manufacturing BOMs, production orders, material issue, and production confirmation flows
- HR departments and employees with company-scoped access controls
- CRM leads and opportunities with company-scoped access controls
- Asset, project, and service management foundation with company-scoped access controls
- Desktop UI workspaces for catalog, procurement, inventory, core master data, finance, and the new asset/project/service workspace

## Completed and verified features
- API build passes
- API test suite passes: 121 passed, 0 failed, 0 skipped
- Desktop build passes
- Environment validation tests pass, including production failures for missing/placeholder database credentials and safe development default behavior
- Focused identity administration regression passes for cross-company custom-role safety and permission escalation
- Procurement-to-inventory workflow passes with requisition, purchase-order, goods-receipt, stock-balance, stock-movement, and invoice-processing coverage
- Earlier frontend runtime issues were addressed in the live working tree and are not present in the current verified build

Incomplete / still outside the current verified baseline:
- Full finance/accounting posting model and final accounting policy verification
- Sales/customer lifecycle and end-to-end commercial flow verification
- Payroll and extended HR administration beyond the foundation employee/department model
- Enterprise reporting, analytics, backup/restore verification, and production-readiness hardening beyond the current baseline
- Remaining approved ERP domains that follow after the current implementation milestone, including broader operational workflow completion and release hardening

Manufacturing-specific verification status:
- Migration 023 is applied in the live development database.
- Focused manufacturing workflow test passed: 1 test, 0 failed.
- The verified manufacturing scope covers BOM creation, production-order creation, material issue posting, and production confirmation without violating stock or FK integrity.

## Files created or modified
Current uncommitted work includes major files under:
- apps/api/src/app.ts
- apps/api/src/modules/security-identity/
- apps/api/src/modules/core-platform/
- apps/api/src/modules/inventory/
- apps/api/src/modules/procurement/
- apps/desktop/src/App.tsx
- apps/desktop/src/api/
- apps/desktop/src/screens/
- database/migrations/
- docs/implementation/

## Database migrations created and actual applied state
Created in repo:
- 001 through 020 migration files exist in the repo.

Current live state:
- 001–020 are recorded as applied in the current development database.
- Live verification via Node + pg confirmed migrations 019 and 020 as present, with migration 020 applied at 2026-10-13T19:51:55.656Z.

Important rule:
- Do not overwrite applied migration history.
- Do not edit applied migrations.

## API build, desktop build, and test results
API build:
- Command: npm run build --workspace @enterprisex/api
- Result: success

API tests:
- Command: npm test --workspace @enterprisex/api
- Result: 111 passed, 0 failed, 0 skipped, 0 todo

Focused identity administration regression:
- Command: node --test apps/api/dist/modules/security-identity/api/administration-route.test.js
- Result: 1 passed, 0 failed

Desktop build:
- Command: npm run build --workspace desktop
- Result: success

Migration history:
- Live query against core.schema_migrations returned versions 019 and 020; migration 020 was applied and no schema rewrite or destructive DB action was performed.

## Known bugs, failing tests, and blockers
Current known status:
- The previously reported API test-cleanup foreign-key failure was not reproducible: the focused test and full API suite both pass. Its teardown deletes company-linked audit events and user-company access rows before deleting the created company.
- No failing API tests and no failing desktop build in the verified run.
- Prior frontend runtime issues were fixed in the current working tree and are not reproduced in the current build.
- Remaining blockers are not build blockers; they are scope blockers in finance, sales, manufacturing, HR, CRM, and enterprise admin completion.

## Current Git branch and uncommitted changes
- Branch: master
- Working tree: dirty with multiple modified/untracked files as shown by git status --short
- Existing changes are intentionally preserved; no destructive Git commands were used.

## Exact next implementation task
Next required task:
- Continue from the verified foundation baseline into the next incomplete ERP domains in dependency order: finance/accounting, sales/customer lifecycle, manufacturing, HR, CRM, assets/projects/services, then reporting and production-readiness hardening.

Acceptance criteria:
- Migrations 001–020 remain applied in the verified development database.
- Company-scoped custom role definitions remain isolated to their company while shared system roles remain global.
- Existing foundation workflows remain green while higher-level modules are implemented.
- Any blocked domain is explicitly documented with the next dependency action required to resume it.

## Commands to verify the current state and safely resume
```powershell
cd C:\Dev\EnterpriseX
git status --short --branch
npm run build --workspace @enterprisex/api
npm test --workspace @enterprisex/api
npm run build --workspace desktop
```

## Safety and resume rules
- Preserve all uncommitted changes and existing database state.
- Do not reset Git or remove Docker volumes.
- Do not rewrite applied migrations.
- Do not claim unverified progress as complete.
- Resume from the current verified state and continue with the next incomplete, dependency-ordered requirement.
