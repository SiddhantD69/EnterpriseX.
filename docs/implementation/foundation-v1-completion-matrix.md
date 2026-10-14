# Foundation V1 Completion Matrix

This matrix reports evidence from the repository and the local development database. `Partial` means an actual persisted workflow exists but the area's requested scope is incomplete. A passing build is not considered proof of completion.

## Current Status (2026-10-13)

| Weighted area | Weight | Status | Evidence | Remaining acceptance work |
| --- | ---: | --- | --- | --- |
| Authentication and session security | 10% | Partial | Argon2 login, company selection, expiration/revocation, logout audit, route integration tests | Rate limiting, recovery/rotation policy, persistent desktop session rehydration |
| User, organization, company, role administration | 10% | Partial | Canonical schema, session-scoped company context, permission middleware | Protected administration APIs/UI for users, organizations, companies, roles and assignments |
| Core operational master data | 10% | Partial | Plants, Warehouses, Storage Locations, Suppliers and Materials; company predicates, parent checks, permissions, audit and tests | Plant updates, richer supplier/material edits and lifecycle dependency rules |
| Shared references/configuration/numbering | 8% | Partial | Configuration API; currencies and UOM CRUD/lifecycle; transactional company document sequences | Fiscal periods, tax configuration, currency conversion and domain rules |
| Procurement | 15% | Partial | Draft requisition create/edit/submit; PO from submitted request; receipts; exact quantity/price invoice matching; audit and integration test | Approval workflow, cancellation policy, invoice adjustments/credit notes and AP posting |
| Inventory | 10% | Partial | Receipt-driven movement ledger and balances; row locks, transaction, no overreceipt, company scoping and consistency assertions | Adjustments, reservations, availability rules, reconciliation jobs, transfer and negative-stock policy |
| Sales and customer management | 7% | Missing | No sales/customer workflow exists | Customer, quotation, order, fulfillment and permissions |
| Finance | 8% | Missing | No chart of accounts, journals or posting service exists | Approved accounting specification, balanced journals, periods and reports |
| Warehouse execution | 4% | Partial | Plant/warehouse/location hierarchy and receipt placement | Putaway/picking tasks, transfers and operational movement workflow |
| Manufacturing | 3% | Missing | No manufacturing schema or workflow | BOM, routing, production orders and inventory integration |
| HR and CRM | 3% | Missing | Identity users exist; no employee or CRM workflow | Employee/leave and contacts/activity foundations |
| Desktop shell and workflows | 6% | Partial | In-memory login/logout, company selection, permission-aware Core/Catalog/Procurement/Inventory navigation; create/list workflows | Edit/lifecycle coverage across screens, pagination/search, frontend automated tests |
| Automated quality | 4% | Partial | API integration suite, transaction/tenant tests, API and desktop builds | Frontend test runner, concurrency and broader domain suites |
| Operations and documentation | 2% | Partial | Docker Compose, health endpoints, setup instructions and endpoint docs | Backup/restore rehearsal, observability, deployment secrets and release automation |
| Weighted area | Weight | Status | Score | Evidence | Remaining acceptance work |
| --- | ---: | --- | ---: | --- | --- |
| Authentication and session security | 10% | Partial | 0.60 | Argon2 login, company selection, expiration/revocation, logout audit, route integration tests | Rate limiting, recovery/rotation policy, persistent desktop session rehydration |
| User, organization, company, role administration | 10% | Partial | 0.30 | Canonical schema, session-scoped company context, permission middleware | Protected administration APIs/UI for users, organizations, companies, roles and assignments |
| Core operational master data | 10% | Partial | 0.65 | Plants, Warehouses, Storage Locations, Suppliers and Materials; company predicates, parent checks, permissions, audit and tests | Plant updates, richer supplier/material edits and lifecycle dependency rules |
| Shared references/configuration/numbering | 8% | Partial | 0.55 | Configuration API; currencies and UOM CRUD/lifecycle; transactional company document sequences | Fiscal periods, tax configuration, currency conversion and domain rules |
| Procurement | 15% | Partial | 0.70 | Draft requisition create/edit/submit; PO from submitted request; receipts; exact quantity/price invoice matching; audit and integration test | Approval workflow, cancellation policy, invoice adjustments/credit notes and AP posting |
| Inventory | 10% | Partial | 0.55 | Receipt-driven movement ledger and balances; row locks, transaction, no overreceipt, company scoping and consistency assertions | Adjustments, reservations, availability rules, reconciliation jobs, transfer and negative-stock policy |
| Sales and customer management | 7% | Missing | 0.00 | No sales/customer workflow exists | Customer, quotation, order, fulfillment and permissions |
| Finance | 8% | Missing | 0.00 | No chart of accounts, journals or posting service exists | Approved accounting specification, balanced journals, periods and reports |
| Warehouse execution | 4% | Partial | 0.15 | Plant/warehouse/location hierarchy and receipt placement | Putaway/picking tasks, transfers and operational movement workflow |
| Manufacturing | 3% | Missing | 0.00 | No manufacturing schema or workflow | BOM, routing, production orders and inventory integration |
| HR and CRM | 3% | Missing | 0.00 | Identity users exist; no employee or CRM workflow | Employee/leave and contacts/activity foundations |
| Desktop shell and workflows | 6% | Partial | 0.55 | In-memory login/logout, company selection, permission-aware Core/Catalog/Procurement/Inventory navigation; create/list workflows | Edit/lifecycle coverage across screens, pagination/search, frontend automated tests |
| Automated quality | 4% | Partial | 0.60 | API integration suite, transaction/tenant tests, API and desktop builds | Frontend test runner, concurrency and broader domain suites |
| Operations and documentation | 2% | Partial | 0.40 | Docker Compose, health endpoints, setup instructions and endpoint docs | Backup/restore rehearsal, observability, deployment secrets and release automation |

## Estimate

The score column assigns a 0–1 fraction to each partial area based on listed acceptance evidence (`Complete = 1`, `Missing = 0`). Sum `weight × score`: the weights sum to 100%; current estimate is **43%**. Applying the same matrix to the pre-procurement baseline (master data 0.50, shared references 0.45, desktop 0.40; the later Procurement/Inventory/Catalog APIs and screens absent) gives **24%**. These are planning estimates, not production-readiness claims; the explicit scope is complete only when every applicable acceptance criterion is verified.

## Business Rules and External Dependencies

- This purchasing slice has no approval transition: draft requisitions are submitted, then a user with PO-create permission may create an order. Add approval only after approving its roles, limits and delegation policy.
- Inventory currently models physical on-hand quantity from purchase receipts only. It does not model reservations, planned stock, transfers or adjustments.
- Procurement uses a material's base UOM only. Conversion factors are not implemented.
- Supplier invoice matching checks received quantity and exact PO unit price. It does not create AP liabilities or accounting journals.
- Tax, currency conversion, fiscal-period close, statutory accounting, payroll and jurisdiction-specific behavior require approved specifications.
- No external supplier/customer services, barcode hardware, ASRS or shop-floor systems are configured.
- Migrations 017 and 018 are recorded as applied to the verified development database. Do not apply them again manually or edit them.