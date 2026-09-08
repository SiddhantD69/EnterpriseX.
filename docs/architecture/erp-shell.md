\# EnterpriseX ERP Shell Architecture



\## 1. Purpose



The EnterpriseX ERP Shell is the application-level foundation that hosts all EnterpriseX business modules.



The shell provides the common application experience while keeping business-module logic outside the desktop UI.



Core principle:



> One system → One data model → Connected business processes → Real-time information.



The shell is responsible for application navigation, authenticated session context, organization/company context, permission-aware access, common UI behavior, API communication, error handling, and integration of future modules.



It must not contain Finance, Procurement, Supply Chain, Sales, Warehouse, Manufacturing, HR, CRM, or other domain business logic.



\---



\## 2. Architectural Position



The desktop application follows this boundary:



```text

┌──────────────────────────────────────────────┐

│              EnterpriseX Desktop             │

│                 Tauri + React                │

│                  TypeScript                  │

│                                              │

│  ┌────────────── ERP Shell ───────────────┐  │

│  │ Navigation                             │  │

│  │ Session Context                        │  │

│  │ Organization / Company Context         │  │

│  │ Permission-aware Access                │  │

│  │ Dashboard                              │  │

│  │ API Client                             │  │

│  │ Common UI / Error Handling              │  │

│  └───────────────────────────────────────┘  │

└──────────────────────┬───────────────────────┘

&#x20;                      │ HTTPS / API

&#x20;                      ▼

┌──────────────────────────────────────────────┐

│             EnterpriseX API                  │

│          Node.js + TypeScript                │

│                                              │

│ API → Application → Domain → Infrastructure  │

└──────────────────────┬───────────────────────┘

&#x20;                      │

&#x20;                      ▼

┌──────────────────────────────────────────────┐

│              PostgreSQL                      │

│          Authoritative ERP Data              │

└──────────────────────────────────────────────┘



The desktop shell is a client of the backend.



The desktop application must never directly access PostgreSQL.



3\. Responsibilities of the ERP Shell



The ERP Shell owns:



Application startup

Session initialization

Authentication state

Current user context

Current organization context

Current company context

Navigation

Module discovery

Permission-aware navigation

Dashboard composition

API client configuration

API error handling

Loading states

Global notifications

Common layout

Common UI primitives

Application-level routing

Session expiration handling

Logout

Client-side observability hooks



The ERP Shell does not own:



Finance business rules

Procurement business rules

Inventory calculations

Warehouse execution logic

Sales order processing

Manufacturing planning

HR business rules

CRM workflows

Accounting posting logic

Domain master-data ownership



Business logic belongs in the backend domain/application layers.



4\. Desktop Technology Boundary



The initial desktop technology is:



Tauri

React

TypeScript



React is responsible for rendering and UI state.



Tauri is responsible for the desktop runtime boundary.



The application must not place business rules inside Tauri commands merely because the desktop runtime can execute them.



Tauri commands should be reserved for legitimate desktop capabilities such as:



File system operations when required

OS integration

Secure desktop capabilities

Native notifications

Printing integration where required

Other approved native capabilities



ERP business operations must go through the EnterpriseX API.



5\. Application Layers



The desktop application should be organized into clear boundaries.



Recommended structure:



apps/desktop/

└── src/

&#x20;   ├── app/

&#x20;   │   ├── App.tsx

&#x20;   │   ├── router/

&#x20;   │   └── providers/

&#x20;   │

&#x20;   ├── shell/

&#x20;   │   ├── layout/

&#x20;   │   ├── navigation/

&#x20;   │   ├── dashboard/

&#x20;   │   └── context/

&#x20;   │

&#x20;   ├── auth/

&#x20;   │   ├── components/

&#x20;   │   ├── session/

&#x20;   │   └── guards/

&#x20;   │

&#x20;   ├── api/

&#x20;   │   ├── client/

&#x20;   │   ├── errors/

&#x20;   │   └── generated/

&#x20;   │

&#x20;   ├── modules/

&#x20;   │   └── <future-module>

&#x20;   │

&#x20;   ├── components/

&#x20;   │   └── common/

&#x20;   │

&#x20;   ├── state/

&#x20;   │

&#x20;   └── main.tsx



The exact directory structure may evolve during implementation, but boundaries must remain explicit.



6\. Session Context



The shell maintains the authenticated application session.



Session context represents:



Current authenticated user

Authentication state

Session expiration state

Current organization

Current company

Effective permissions

Accessible companies



The shell consumes this information.



It does not determine authorization independently.



Authorization decisions are ultimately enforced by the backend.



7\. Organization and Company Context



EnterpriseX supports:



Organization

&#x20;   │

&#x20;   ├── Company A

&#x20;   ├── Company B

&#x20;   └── Company C



A user may have access to one or more companies.



The ERP shell provides the user with the ability to select an accessible company where the business workflow permits it.



The selected company becomes the active application context.



The backend remains authoritative for validating whether the user can access that company.



The desktop client must never assume that selecting a company grants access.



8\. Context Switching



When the user changes company context:



The client requests/loads the available company context.

The backend validates access.

The active company context is updated.

Context-dependent application state is invalidated or refreshed.

Dashboard data is refreshed.

Module data is refreshed as required.

Pending operations tied to the previous context are handled safely.

The UI clearly reflects the active company.



A company switch must not silently mix data between companies.



9\. Navigation Architecture



Navigation is module-oriented.



Initial conceptual navigation:



EnterpriseX

│

├── Dashboard

│

├── Finance

├── Procurement

├── Supply Chain

├── Inventory

├── Warehouse

├── Sales

├── CRM

├── Manufacturing

├── HR

├── Asset Management

├── Projects

├── Service Management

│

├── Analytics

├── Reporting

│

└── Administration



Not all modules need to be implemented immediately.



The shell must support modules being introduced incrementally.



10\. Module Registration



Modules should expose metadata to the shell rather than hard-coding business-module behavior into the shell.



Conceptual module registration:



type ModuleDefinition = {

&#x20; code: string;

&#x20; name: string;

&#x20; route: string;

&#x20; requiredPermissions: string\[];

};



The final contract will be defined during implementation.



The shell uses module metadata to determine:



Display name

Navigation location

Route

Required permissions

Availability



The module itself owns its domain-specific screens and workflows.



11\. Permission-Aware Navigation



Navigation visibility may be filtered using effective permissions.



However:



Hidden UI is not authorization.



A module may be hidden from navigation when the user lacks permission, but every protected API operation must independently enforce authorization on the backend.



Example:



User

&#x20; │

&#x20; ▼

Effective Permissions

&#x20; │

&#x20; ├── finance.read

&#x20; ├── finance.post

&#x20; └── inventory.read

&#x20;         │

&#x20;         ▼

Permission-aware navigation



The backend remains the security authority.



12\. Routing



The shell owns application-level routing.



Routes should be organized around module boundaries.



Conceptual routes:



/dashboard



/finance/...

/procurement/...

/supply-chain/...

/inventory/...

/warehouse/...

/sales/...

/crm/...

/manufacturing/...

/hr/...

/assets/...

/projects/...

/service/...



/analytics/...

/reports/...



/administration/...



Routes must not become a substitute for authorization.



Protected routes require authenticated session state.



Module operations require backend authorization.



13\. Dashboard Boundary



The dashboard belongs to the ERP shell as an application-level experience.



The initial dashboard should provide common ERP information such as:



Current company

User/session information

Available modules

System status

Important notifications

Future KPI/widget areas



Domain-specific KPIs should be supplied by the owning module or reporting/analytics layer.



The shell must not calculate accounting, inventory, sales, production, or HR KPIs itself.



14\. API Communication



The desktop application communicates with the backend through an API client.



Conceptual flow:



React Component

&#x20;     │

&#x20;     ▼

Application/API Client

&#x20;     │

&#x20;     ▼

EnterpriseX API

&#x20;     │

&#x20;     ▼

Application Service

&#x20;     │

&#x20;     ▼

Domain

&#x20;     │

&#x20;     ▼

Infrastructure

&#x20;     │

&#x20;     ▼

PostgreSQL



React components must not contain raw database logic.



React components should not directly construct business rules that belong to backend services.



15\. API Contract Boundary



The desktop client should consume explicit API contracts.



API contracts should define:



Request shape

Response shape

Validation

Authentication requirements

Authorization requirements

Error structure

Versioning expectations



Shared API contracts may eventually live under:



packages/contracts



The API contract becomes the boundary between desktop and backend.



16\. Error Handling



The shell must provide consistent handling for:



Authentication errors



Examples:



Session expired

Invalid authentication

Account locked



Expected behavior may include:



Session expired

&#x20;     ↓

Clear session

&#x20;     ↓

Return to login

Authorization errors



Examples:



403 Forbidden

Missing permission



The UI should show a clear access-denied state.



Validation errors



Validation errors should identify the affected fields where possible.



Business errors



Business-rule failures should be presented using a consistent error model.



Infrastructure errors



Database, network, or unexpected server errors must not expose sensitive internal information to the user.



17\. Loading States



Every API-driven screen must have defined loading behavior.



The shell should support:



Initial loading

Background refresh

Empty state

Error state

Retry

Successful state



A loading state must not be confused with authorization.



18\. Notifications



The shell may provide global notification infrastructure.



Examples:



Success notifications

Validation messages

Business-rule errors

System warnings

Session warnings



Domain modules provide the business meaning.



The shell provides the common presentation mechanism.



19\. Security Boundary



The desktop application is not a trusted authorization boundary.



Security responsibilities:



Desktop

Protect session information appropriately

Avoid exposing secrets

Avoid storing unnecessary sensitive information

Use secure API communication

Respect permission state

Avoid logging sensitive information

Backend

Authenticate requests

Authorize operations

Validate input

Enforce company context

Enforce business rules

Enforce data access boundaries

Database

Enforce structural integrity

Enforce foreign keys

Enforce constraints

Protect transactional consistency

20\. Data Isolation



EnterpriseX must prevent accidental cross-company data access.



Every module that operates within company scope must respect the active company context.



The backend must validate:



Authenticated User

&#x20;       +

Organization Context

&#x20;       +

Company Context

&#x20;       +

Permission

&#x20;       ↓

Authorized Operation



The client cannot be trusted to provide valid context by itself.



21\. Audit Integration



The shell and backend must support the Core Audit architecture.



Security-sensitive and application-significant operations may generate audit events.



Examples:



Login

Logout

Company context changes

Permission changes

Configuration changes

Administrative actions



Audit generation belongs at the appropriate backend/application boundary.



The desktop UI should not directly write audit records.



22\. Module Isolation



The shell must remain independent of module-specific domain logic.



For example:



ERP Shell

&#x20;   │

&#x20;   ├── Finance module

&#x20;   │

&#x20;   ├── Supply Chain module

&#x20;   │

&#x20;   ├── Sales module

&#x20;   │

&#x20;   └── Warehouse module



Finance must not directly modify Supply Chain UI state.



Cross-module business interactions occur through backend contracts and approved integration boundaries.



23\. State Management



State should be separated by responsibility.



Session state



Examples:



Current user

Authentication status

Active organization

Active company

Effective permissions

Server state



Examples:



Dashboard data

Module data

Company list

User profile

UI state



Examples:



Sidebar expanded/collapsed

Modal visibility

Temporary form state

Selected UI filters



The implementation technology may evolve.



The architectural separation must remain.



24\. Caching



Caching must not compromise ERP data correctness.



The system should prefer correctness over aggressive client-side caching.



Data that changes frequently or has financial/transactional significance must be refreshed according to explicit API semantics.



Client cache invalidation must be designed around API contracts.



25\. Offline Behavior



The initial EnterpriseX architecture does not assume full offline ERP operation.



Offline functionality must not be introduced casually because transactional ERP workflows require authoritative server state.



If offline capabilities are introduced later, they require explicit architecture covering:



Local persistence

Conflict resolution

Transaction ordering

Security

Synchronization

Audit

Failure recovery

26\. Observability



The shell should support application-level observability.



Useful information includes:



Application startup

API request failures

Session events

Navigation failures

Unexpected client errors



Sensitive information must not be logged.



Request and correlation identifiers should be propagated where supported by the API.



27\. Testing Strategy



The ERP shell requires:



Unit tests



For:



Session state

Context handling

Permission filtering

Navigation logic

Error mapping

Integration tests



For:



API client behavior

Authentication flows

Company context

Permission-aware behavior

End-to-end tests



For critical workflows such as:



Login

&#x20; ↓

Select Company

&#x20; ↓

Open Dashboard

&#x20; ↓

Open Authorized Module



and:



Login

&#x20; ↓

Select Company

&#x20; ↓

Attempt Unauthorized Module

&#x20; ↓

Access Denied

28\. Module Onboarding Contract



Every future module integrated into the ERP shell should provide:



Module code

Display name

Navigation metadata

Route definitions

Required permissions

Entry point

Error/loading states

API contracts

Tests

Documentation



The shell should not require changes to unrelated modules when a new module is added.



29\. Versioning and Compatibility



The shell/API boundary must support controlled evolution.



Breaking API changes require explicit versioning or migration strategy.



The desktop client must not silently depend on undocumented API behavior.



Module contracts must be documented before implementation.



30\. Performance Principles



The initial application should prioritize:



Correctness

Maintainability

Clear boundaries

Predictable API behavior



Premature optimization should be avoided.



Performance optimization should be based on observed bottlenecks.



The architecture must remain capable of scaling without immediately introducing distributed-system complexity.



31\. Failure Handling



The shell must handle:



API unavailable

Database unavailable as reported by backend

Session expiration

Authorization failure

Validation failure

Unexpected server errors

Network interruption

Invalid application state



Failures should produce actionable user-facing behavior without exposing internal implementation details.



32\. Definition of Done



The ERP Shell architecture is considered implemented only when:



Desktop application starts successfully

Authentication/session boundary exists

Organization/company context exists

Navigation exists

Permission-aware navigation exists

Dashboard shell exists

API client exists

Error handling exists

Loading/empty/error states exist

Backend authorization remains authoritative

Module boundaries are respected

Audit integration boundary exists

Automated tests exist

Documentation is updated

No business-domain logic is incorrectly placed in the shell

33\. Architectural Decisions

Decision 1 — Desktop is an API client



The desktop application does not directly access PostgreSQL.



Decision 2 — Backend owns business logic



Business rules remain in backend application/domain layers.



Decision 3 — Backend owns authorization



Client-side permission filtering improves UX but is not a security boundary.



Decision 4 — Shell owns common application experience



Navigation, session context, company context, dashboard composition, and common UI behavior belong to the shell.



Decision 5 — Modules own domain functionality



Each ERP module owns its domain workflows and business logic.



Decision 6 — No premature offline architecture



Offline transactional ERP behavior requires a separate approved architecture.



Decision 7 — Modular monolith remains the initial backend architecture



The ERP Shell does not change the modular-monolith decision.



34\. Future Evolution



The shell should support future:



Desktop application expansion

Additional ERP modules

Reporting dashboards

Analytics widgets

Notifications

Workflow interfaces

External integrations

Native desktop capabilities

Multi-company operation

Enterprise administration



without requiring fundamental architectural replacement.



35\. Final Principle



The EnterpriseX ERP Shell is the common application foundation.



It provides:



Identity

&#x20;  +

Context

&#x20;  +

Navigation

&#x20;  +

Permissions

&#x20;  +

Dashboard

&#x20;  +

API Boundary

&#x20;  +

Common UX

&#x20;  ↓

EnterpriseX Modules



It does not become the business logic layer.



The shell connects the ERP experience while preserving strong module boundaries and a single authoritative backend data model

