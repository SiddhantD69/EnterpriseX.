# EnterpriseX Completion Matrix

This matrix records the repository's current evidence-based status as of 2026-10-14.

## Current milestone
Current milestone: Foundation V1 functional baseline for identity, core master data, procurement, inventory, warehouse, finance, desktop ERP shell, manufacturing, HR, CRM, and asset/project/service management, with company-scoped custom-role enforcement and the later ERP domain modules added via migrations 020, 023, 024, 025, and 026.

Verified evidence:
- Focused identity-administration regression passed: 1 test, 0 failed, including company-scoped custom-role creation and cross-company assignment rejection.
- Focused manufacturing regression passed: 1 test, 0 failed, covering BOM creation, production-order creation, material issue, and completion confirmation.
- Focused HR regression passed: 1 test, 0 failed, covering departments, employee creation, duplicate prevention, permission checks, and company-scoped isolation.
- Focused CRM regression passed: 1 test, 0 failed, covering leads, opportunities, permission checks, and company-scoped isolation.
- Focused asset/project/service regression passed: 1 test, 0 failed, covering asset creation, project creation, service creation, permission checks, and company-scoped isolation.
- Environment validation tests passed: production startup rejects missing or placeholder credentials; safe local development defaults remain supported.
- API build passed.
- Desktop build passed.
- Live database verification confirmed the migration history includes 024, 025, and 026 in addition to the earlier core and foundation migrations.

## Verified complete / implemented areas
- Authentication and login
- Session lifecycle and company selection
- Security and identity authorization model
- Startup credential validation for production and documented local development defaults
- Company-scoped custom roles and permission sets while preserving shared system roles via migration 020
- Role assignment boundaries that reject cross-company custom-role adoption
- Core platform master data for plants, warehouses, storage locations
- Supplier/material catalog foundation
- Procurement requisitions, PO creation, goods receipt, stock balances, movement ledger, and invoice matching
- Inventory stock visibility and movement history for company-scoped stock
- Manufacturing BOM and production-order workflow foundation
- HR department and employee foundation with company-scoped authorization
- CRM lead and opportunity foundation with company-scoped authorization
- Asset, project, and service management foundation with company-scoped authorization
- Desktop workspaces for core master data, procurement, inventory, catalog access, finance, and asset/project/service operations
- Audit event capture and persistence
- Permission-aware module navigation

## Partially implemented areas
- Organization/company administration endpoints and UI are present but need final verification and policy completion.
- User, role, and company access administration are partially implemented and require explicit scope verification.
- Finance, sales, reporting, backup/restore verification, and broader payroll/operational workflows remain outside the current verified baseline beyond the current domain foundations.
- Manufacturing, HR, CRM, and asset/project/service are now verified as implemented at the foundation level within the current baseline.

## Not started / deferred
- Accounts payable posting and general ledger accounting model beyond the current verified baseline
- Sales order and customer lifecycle modules
- Payroll and extended HR administration workflows
- Enterprise analytics, reporting, and backup/restore verification beyond the current domain baselines
- Final production-readiness hardening across the remaining ERP domains

## Files created or modified in the working tree
Major work areas currently present in the repo include:
- apps/api/src/app.ts
- apps/api/src/modules/security-identity/api/auth-route.ts
- apps/api/src/modules/security-identity/api/auth-route.test.ts
- apps/api/src/modules/security-identity/api/administration-route.ts
- apps/api/src/modules/security-identity/application/administration-service.ts
- apps/api/src/modules/security-identity/infrastructure/administration-repository.ts
- apps/api/src/modules/core-platform/application/organization-admin-service.ts
- apps/api/src/modules/core-platform/master-data/
- apps/api/src/modules/inventory/
- apps/api/src/modules/procurement/
- apps/desktop/src/App.tsx
- apps/desktop/src/api/master-data-api.ts
- apps/desktop/src/api/procurement-api.ts
- apps/desktop/src/api/inventory-api.ts
- apps/desktop/src/screens/MasterDataWorkspace.tsx
- apps/desktop/src/screens/InventoryWorkspace.tsx
- apps/desktop/src/screens/ProcurementWorkspace.tsx
- apps/desktop/src/screens/CatalogWorkspace.tsx
- database/migrations/016_add_core_master_data_permissions.sql
- database/migrations/017_create_procurement_inventory_foundation.sql
- database/migrations/018_add_procurement_inventory_permissions.sql
- database/migrations/019_add_identity_administration_permissions.sql
- docs/implementation/PROGRESS_CHECKPOINT.md
- docs/implementation/foundation-v1-completion-matrix.md
- docs/implementation/procurement-inventory-initial-slice.md

## Database migration status
Applied migration history in the live development database (verified with a live Node + pg query):
- 001 through 026 are present and applied in the current working database history.
- 024, 025, and 026 were applied after the HR, CRM, and asset/project/service migration runs.

This is the exact status to preserve: do not edit or rewrite applied migration history.

## Verified build and test results
API build:
- Command: npm run build --workspace @enterprisex/api
- Result: success

API tests:
- Command: npm test --workspace @enterprisex/api
- Result: 121 passed, 0 failed, 0 skipped, 0 todo

Desktop build:
- Command: npm run build --workspace desktop
- Result: success; Vite production build completed successfully

Environment validation:
- Command: node --test apps/api/dist/config/env.test.js
- Result: 4 passed, 0 failed

## Known bugs and blockers
Current verified status:
- No failing API tests; the reported test-cleanup foreign-key failure was not reproducible in focused or full-suite runs.
- No desktop build failure.
- No failing migration status on the current database history.
- The previously reported runtime issues in MasterDataWorkspace and InventoryWorkspace were fixed in the current working tree and are not currently present in the checked build.
- Remaining blockers are business-scope blockers, not build blockers: finance, sales, manufacturing, HR, CRM, and full AP/GL accounting are not yet complete.

## Git branch and worktree state
- Current branch: master
- Working tree: uncommitted changes present
- Repository currently contains many modified and untracked files. This is preserved intentionally.

## Exact next implementation task
Next task: continue with the remaining approved ERP domains outside the foundation baseline in dependency order: finance/accounting, sales/customer lifecycle, manufacturing, HR, CRM, assets/projects/services, then reporting and production-readiness hardening.

Acceptance criteria:
- Migrations 001–020 remain applied in the verified database.
- Existing foundation workflows remain green as higher-level modules are implemented.
- Any blocked domain is explicitly documented with the exact dependency or missing requirement needed to resume it.
- No new change weakens company isolation, transaction integrity, or authorization enforcement.

## Commands to verify the current state and safely resume
```powershell
cd C:\Dev\EnterpriseX
git status --short --branch
npm run build --workspace @enterprisex/api
npm test --workspace @enterprisex/api
npm run build --workspace desktop
npm run db:migrate --workspace @enterprisex/api
```

Resume only after confirming the current branch, migration state, and build/test results from the actual repository state.
