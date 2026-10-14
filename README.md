\# EnterpriseX



EnterpriseX is an Enterprise Resource Planning (ERP) platform under active Foundation V1 development. It is not production-certified.



\## Vision



One system → One data model → Connected business processes → Real-time information.



\## Technology



\- Desktop: Tauri + React + TypeScript

\- Backend: Node.js + TypeScript

\- Database: PostgreSQL

\- Infrastructure: Docker

\- Version Control: Git



\## Project Status



Foundation V1 — Development



\## Architecture



EnterpriseX uses a modular architecture with clear ownership boundaries between business domains.



Major domains include:



\- Core Platform

\- Security \& Identity

\- Data Platform

\- Finance

\- Supply Chain

\- Sales

\- Warehouse

\- Manufacturing

\- HR

\- CRM

\- Integration

\- Analytics

\- QA

\- DevOps / Release

## Environment and secret management

EnterpriseX must not commit or log real credentials. For local development, copy [.env.example](.env.example) to a local `.env` file and set explicit values for your machine. The repository does not ship production secrets.

```powershell
Copy-Item .env.example .env
# then edit .env to set the database password and any local overrides
```

Required environment variables:

- `NODE_ENV` — defaults to `development` for local work.
- `API_HOST` — defaults to `127.0.0.1`.
- `API_PORT` — defaults to `3000` for local development.
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER` — default to local PostgreSQL values for development.
- `DATABASE_PASSWORD` — required in production; local development may use a non-production placeholder value supplied in the local environment or `.env` file.

The runtime validates required values at startup. Production is blocked if critical database configuration is missing, empty, or still set to the local development fallback password. This prevents accidental deployment with blank or placeholder credentials while preserving the current local Docker Compose development path.

## Foundation Setup

The development database is PostgreSQL in Docker Compose. From the repository root:

```powershell
docker compose -f infrastructure/docker/docker-compose.yml up -d
npm run build --workspace @enterprisex/api
npm test --workspace @enterprisex/api
npm run db:migrate --workspace @enterprisex/api
```

The migration runner applies only versions absent from `core.schema_migrations`. Confirm the configured host, database, and user target the intended development database before running it. Migrations 017 and 018 are additive and recorded as applied in the verified development database.

Set `ENTERPRISEX_DEV_PASSWORD` in the environment and run `npm run dev:setup --workspace @enterprisex/api` to configure the development user's password. Start the API with `npm run dev --workspace @enterprisex/api` and the desktop with `npm run dev --workspace desktop`. Vite proxies `/api` requests to `http://127.0.0.1:3000`. Run `npm run build --workspace desktop` to type-check and build the desktop application.

## Safe credential rotation procedure

Do not change a live database password automatically. Use this safe sequence:

1. Create a new strong password value in a secure secret store or local environment manager.
2. Update the target environment or deployment secret for the database service only.
3. Apply the new password to the running service configuration without modifying the historical migration records.
4. Restart the database or service in the intended environment after verifying the application can connect with the new value.
5. Validate the API health and a known database-backed flow before removing the old credential from the rotation window.
6. Keep the old secret only until the replacement is verified, then retire it.

Important: `change_me` is a local development placeholder for the current Docker Compose stack. It is not a production value and must be overridden in any real deployment or environment-specific configuration.

## Implemented Foundation

The API includes login/session authentication, company selection/context, configuration, audit events, company-scoped Plants, Warehouses, Storage Locations, supplier/material catalogs, a requisition-to-purchase-order workflow, goods receipt, stock balances/movements, and basic supplier invoice matching. Contracts and explicit limitations are documented in [Procurement and Inventory](docs/implementation/procurement-inventory-initial-slice.md); implementation status is tracked in the [Foundation V1 completion matrix](docs/implementation/foundation-v1-completion-matrix.md). Sales, finance posting, approvals, adjustments, manufacturing, HR and CRM remain deferred.

