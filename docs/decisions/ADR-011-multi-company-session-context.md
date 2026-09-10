\# ADR-011 — Multi-Company Session Context



\- Status: Accepted

\- Date: 2026-09-10

\- Decision Owner: EnterpriseX Product Owner

\- Architecture Owner: EnterpriseX Chief Architect

\- Scope: Security \& Identity / Core Platform

\- Related Area: Authentication, Authorization, Company Context



\---



\## 1. Decision



EnterpriseX will use the authenticated server-side session as the authoritative source for the user's active company context.



The `security.sessions` model will be extended with a nullable `company\_id`.



The selected company will determine the company-scoped authorization context for authenticated ERP requests.



\---



\## 2. Problem



EnterpriseX supports users having access to multiple companies.



The current session model identifies the authenticated user but does not explicitly identify the company against which the authenticated session is operating.



Without an explicit company context, the backend could encounter an ambiguous situation where a user has access to multiple companies.



The system must never arbitrarily select a company for an authenticated request.



Company context must therefore be explicit, validated, and server-controlled.



\---



\## 3. Approved Model



The session will contain:



\- session ID

\- user ID

\- selected company ID

\- session token hash

\- session status

\- creation timestamp

\- expiry timestamp

\- last-seen timestamp

\- revocation timestamp



Conceptually:



User

&#x20; |

&#x20; +-- Session

&#x20;       |

&#x20;       +-- Selected Company

&#x20;               |

&#x20;               +-- Company-scoped Roles

&#x20;                       |

&#x20;                       +-- Permissions



\---



\## 4. Company Selection Rules



\### 4.1 User with one accessible company



If the authenticated user has exactly one active company access:



1\. Authentication succeeds.

2\. The backend determines the user's active company access.

3\. The session is created with that company as the selected company.

4\. The authenticated context is resolved for that company.



No additional company-selection step is required.



\---



\### 4.2 User with multiple accessible companies



If the authenticated user has multiple active company accesses:



1\. Authentication succeeds.

2\. A server-side session is created.

3\. The session initially has no selected company.

4\. The client must select a company.

5\. The backend validates the requested company.

6\. The validated company becomes the session's selected company.

7\. Authenticated context is resolved for that company.



The backend must not select the first company returned by a database query.



\---



\### 4.3 User with no accessible companies



Authentication may succeed as an identity operation, but the user must not receive an authenticated ERP company context.



Protected ERP operations requiring company context must be denied until valid company access exists.



\---



\## 5. Company Selection Validation



When selecting a company, the backend must verify:



1\. The session is valid.

2\. The authenticated user is active.

3\. The requested company exists.

4\. The requested company is active.

5\. The company belongs to the expected organization.

6\. The user has active access to the company.



Only after all validations succeed may the session's `company\_id` be updated.



The client interface must never be trusted as proof of company authorization.



\---



\## 6. Authorization Model



Authorization remains backend authoritative.



Company-scoped authorization will be resolved using:



Session

&#x20; -> Selected Company

&#x20; -> User's company-scoped roles

&#x20; -> Role permissions



A role assigned to Company A must not provide permissions while the session is operating against Company B.



The existing company-scoped authorization boundary must remain enforced through the `security.user\_roles.company\_id` relationship.



\---



\## 7. Session Context



The authenticated context will continue to expose:



\- user

\- organization

\- company

\- roles

\- permissions

\- session identity



The existing `AuthenticatedContext` domain model will be preserved unless implementation work identifies a strictly necessary change.



The active company will therefore remain part of the trusted backend context rather than becoming a UI-only concept.



\---



\## 8. Company Switching



EnterpriseX will support explicit company switching through a backend-controlled operation.



Proposed endpoint:



POST /api/v1/auth/company/select



The request will identify the desired company.



The backend will validate access before changing the session's selected company.



After switching company:



1\. The session's selected company changes.

2\. Authorization is resolved against the new company.

3\. Previous company permissions must not remain implicitly active.

4\. A security audit event is recorded.



\---



\## 9. Audit Requirements



Company context selection and switching must be auditable.



The security audit subsystem will record a company-context selection event.



The audit event should include appropriate:



\- actor user ID

\- organization ID

\- company ID

\- source module

\- action

\- timestamp

\- request/correlation identifiers when available



Session tokens, passwords, password hashes, and other authentication secrets must never be stored in audit records.



\---



\## 10. Security Requirements



The implementation must prevent:



\- arbitrary company selection

\- unauthorized company access

\- cross-company role leakage

\- cross-company permission leakage

\- stale company authorization

\- privilege escalation through company switching

\- trusting client-supplied company identifiers without backend validation



The UI may display and request company context, but the backend remains the authority.



\---



\## 11. Database Decision



The `security.sessions` table will be extended with:



company\_id UUID NULL



The column will reference:



core.companies(id)



The column is intentionally nullable because a multi-company user may authenticate successfully before selecting a company.



The migration must preserve existing sessions and existing development data.



No production database changes will be performed manually.



All schema changes will use versioned migrations.



\---



\## 12. Compatibility



Existing single-company development behavior must continue to work.



Existing sessions must not become invalid merely because the new nullable column is introduced.



Existing authentication and session lifecycle behavior must continue to pass regression tests.



The development seed must remain usable.



\---



\## 13. API Behavior



The intended authentication flow becomes:



Login

&#x20; |

&#x20; +-- Authenticate credentials

&#x20; |

&#x20; +-- Determine active company access

&#x20; |

&#x20; +-- One company?

&#x20; |      |

&#x20; |      +-- Yes -> assign company to session

&#x20; |

&#x20; +-- Multiple companies?

&#x20; |      |

&#x20; |      +-- Yes -> session company remains NULL

&#x20; |

&#x20; +-- Return authentication/company-selection state



After company selection:



Company Select

&#x20; |

&#x20; +-- Validate session

&#x20; +-- Validate user

&#x20; +-- Validate organization/company

&#x20; +-- Validate user-company access

&#x20; +-- Set session.company\_id

&#x20; +-- Record audit event

&#x20; +-- Resolve authenticated context



\---



\## 14. Request Context



For company-scoped ERP operations, the trusted request context must ultimately resolve to:



\- authenticated user

\- authenticated session

\- organization

\- selected company

\- company-scoped roles

\- company-scoped permissions



The system must not derive active company context by selecting an arbitrary row from the user's company-access records.



\---



\## 15. Testing Requirements



The implementation must include automated tests covering at minimum:



1\. Single-company login automatically establishes company context.

2\. Multi-company login creates a session without an active company.

3\. Multi-company user can select an authorized company.

4\. Unauthorized company selection is rejected.

5\. Inactive company selection is rejected.

6\. Company from another organization is rejected.

7\. Company switching updates the session context.

8\. Permissions are re-resolved after company switching.

9\. Company A roles do not leak into Company B context.

10\. Revoked sessions cannot select or switch companies.

11\. Expired sessions cannot select or switch companies.

12\. Company-context security events are audited.

13\. Existing authentication/session tests continue to pass.



\---



\## 16. Migration Requirements



The database migration must:



1\. Add nullable `company\_id` to `security.sessions`.

2\. Add the foreign-key relationship to `core.companies`.

3\. Add an appropriate index if required by the final query design.

4\. Preserve existing session records.

5\. Provide a safe rollback strategy.

6\. Be registered through `core.schema\_migrations`.



No existing migration will be edited.



\---



\## 17. Implementation Sequence



Implementation will proceed in this order:



1\. Architecture decision record.

2\. Database migration.

3\. Session domain/repository update.

4\. Authentication/company-selection application logic.

5\. Authenticated-context repository update.

6\. Authentication middleware update.

7\. Company-selection API.

8\. Security audit integration.

9\. Integration and security tests.

10\. Full regression test.

11\. Documentation update.

12\. Git commit.



Each stage must be validated before moving to the next stage.



\---



\## 18. Explicit Non-Decisions



This ADR does not approve:



\- migration to microservices

\- replacement of server-side sessions with JWT

\- creation of a separate authorization database

\- duplication of permissions into the desktop client

\- client-authoritative company context

\- changes to business-domain modules

\- distributed session infrastructure

\- premature caching of authorization state



Those decisions remain outside this ADR.



\---



\## 19. Consequence



This design provides EnterpriseX with an explicit and auditable company boundary for authenticated ERP operations.



It removes the ambiguity of selecting an arbitrary company when a user has multiple company accesses.



It also establishes a foundation for future modules such as:



\- Finance

\- Procurement

\- Inventory

\- Warehouse

\- Sales

\- Manufacturing

\- HR

\- CRM

\- Projects

\- Service Management

\- Analytics



All company-scoped business operations can rely on the same trusted session/company context.



\---



\## 20. Approval



Product Owner approval received:



APPROVED — 2026-09-10



Approved architectural decision:



Add nullable `company\_id` to `security.sessions`; require explicit company selection for multi-company users; automatically select the sole accessible company; resolve authorization strictly from the session's selected company.

