\# EnterpriseX Authorization Database Architecture



\## 1. Purpose



This document defines the foundational authorization model for EnterpriseX.



The authorization model determines what an authenticated user is allowed to do within EnterpriseX.



EnterpriseX separates:



\- Identity

\- Authentication

\- Organization/company access

\- Roles

\- Permissions



The identity model answers:



> Who is the user?



Authentication answers:



> Has the user successfully proven their identity?



Company access answers:



> Where can the user operate?



Authorization answers:



> What can the user do?



\---



\## 2. Ownership



The Security \& Identity domain owns:



\- Users

\- Authentication credentials

\- User company access

\- Roles

\- Permissions

\- User role assignments

\- Authorization evaluation



The Core Platform owns:



\- Organizations

\- Companies



Business modules own their own business capabilities and resources.



Authorization controls access to those capabilities.



\---



\## 3. Authorization Architecture



```text

User

&#x20;|

&#x20;+---- Company Access

&#x20;|

&#x20;+---- Role Assignment

&#x20;         |

&#x20;         v

&#x20;       Role

&#x20;         |

&#x20;         v

&#x20;    Permissions

&#x20;         |

&#x20;         v

&#x20;  Business Capability



A user receives permissions through role assignments.



Direct user-to-permission assignment is intentionally not part of the initial architecture.



4\. Role-Based Access Control



EnterpriseX will use Role-Based Access Control (RBAC) as the foundational authorization model.



The basic relationship is:



User

&#x20; |

&#x20; +---- Role

&#x20;          |

&#x20;          +---- Permission



Roles group permissions into meaningful business responsibilities.



Examples include:



Administrator

Finance Manager

Finance User

Warehouse Manager

Warehouse User

Procurement Manager

Sales Manager

Sales User

Reporting User



Actual production roles will be defined by business requirements and module implementation.



5\. Roles



A role represents a reusable collection of permissions.



Conceptually:



Role

&#x20;|

&#x20;+---- Name

&#x20;+---- Code

&#x20;+---- Description

&#x20;+---- Status



Roles should be stable business concepts rather than temporary collections of individual users.



A role can be assigned to multiple users.



A user can have multiple roles.



6\. Permissions



A permission represents an atomic authorization capability.



Permissions should be defined using a consistent resource/action model.



Conceptually:



Resource + Action



Examples:



invoice.read

invoice.create

invoice.update

invoice.approve



purchase\_order.read

purchase\_order.create

purchase\_order.update

purchase\_order.approve



warehouse\_stock.read

warehouse\_stock.adjust



The exact permission catalogue will be defined progressively as business modules are implemented.



7\. Permission Naming Convention



EnterpriseX permissions should follow:



<resource>.<action>



Examples:



user.read

user.create

user.update

user.disable



company.read

company.update



invoice.read

invoice.create

invoice.update

invoice.approve



purchase\_order.read

purchase\_order.create

purchase\_order.approve



Permission codes must be:



Unique

Stable

Machine-readable

Human understandable

Independent from UI labels

8\. Role-Permission Relationship



A role may contain multiple permissions.



A permission may belong to multiple roles.



Therefore the relationship is many-to-many.



Conceptually:



Role

&#x20;|

&#x20;+---- Role Permission

&#x20;             |

&#x20;             v

&#x20;         Permission



The database will enforce uniqueness so that the same permission cannot be assigned twice to the same role.



9\. User-Role Relationship



A user may have multiple roles.



A role may be assigned to multiple users.



Therefore the relationship is many-to-many.



Conceptually:



User

&#x20;|

&#x20;+---- User Role

&#x20;         |

&#x20;         v

&#x20;        Role



The same role must not be assigned twice to the same user within the same authorization scope.



10\. Authorization Scope



EnterpriseX authorization must respect organizational context.



The initial authorization model will support company-scoped role assignments.



Conceptually:



User

&#x20;|

&#x20;+---- Company Access

&#x20;|

&#x20;+---- Company Role Assignment

&#x20;            |

&#x20;            v

&#x20;           Role

&#x20;            |

&#x20;            v

&#x20;       Permissions



This prevents a role assigned in one company from automatically granting access to another company.



11\. Company Isolation



A user's access to one company must not automatically grant access to another company.



For example:



User A

&#x20;|

&#x20;+---- Company A

&#x20;|       |

&#x20;|       +---- Finance Manager

&#x20;|

&#x20;+---- Company B

&#x20;        |

&#x20;        +---- Warehouse User



The user may have different roles in different companies.



Authorization evaluation must therefore include company context.



12\. Organization Context



Company-scoped authorization depends on the existing Core Platform hierarchy:



Organization

&#x20;    |

&#x20;    +---- Company



Authorization must validate that the requested company belongs to the active organization context.



The application must never trust organization/company identifiers supplied by an untrusted client without authorization validation.



13\. Role Status



Roles should support lifecycle management.



Conceptual role statuses:



ACTIVE

INACTIVE



Inactive roles must not grant new authorization.



Existing assignments to inactive roles must be treated as unauthorized during permission evaluation.



14\. Permission Status



Permissions are foundational system capabilities.



Permissions should normally be treated as active definitions unless explicitly retired by the authorization architecture.



Removing or renaming production permissions requires controlled migration and compatibility review.



Permission codes should therefore remain stable.



15\. Direct Permission Assignment



EnterpriseX will not initially support:



User

&#x20;|

&#x20;+---- Permission



Direct permission assignment can create authorization complexity and makes permission auditing harder.



The preferred model is:



User

&#x20;|

&#x20;+---- Role

&#x20;       |

&#x20;       +---- Permission



Any future introduction of direct permissions requires architectural review.



16\. Role Hierarchy



The initial authorization model will NOT implement hierarchical roles.



For example, the system will not initially assume:



Administrator

&#x20;    |

&#x20;    +---- Manager

&#x20;            |

&#x20;            +---- User



Role inheritance may be introduced later if real business requirements justify it.



Until then, permissions must be explicitly assigned to each role.



17\. Separation of Duties



EnterpriseX authorization must support separation-of-duties principles.



Sensitive business processes may require different roles for different actions.



Example:



Purchase Request

&#x20;      |

&#x20;      v

Purchase Order

&#x20;      |

&#x20;      v

Approval

&#x20;      |

&#x20;      v

Payment



The same user should not automatically receive every permission simply because they belong to one broad role.



Business modules will define sensitive approval boundaries.



18\. Authorization Evaluation



Authorization should be evaluated by backend application services.



The desktop UI must not be treated as the security boundary.



Conceptual flow:



API Request

&#x20;   |

&#x20;   v

Authenticate User

&#x20;   |

&#x20;   v

Resolve Organization/Company Context

&#x20;   |

&#x20;   v

Load Applicable Roles

&#x20;   |

&#x20;   v

Resolve Permissions

&#x20;   |

&#x20;   v

Evaluate Required Permission

&#x20;   |

&#x20;   +---- Allowed ----> Execute Business Operation

&#x20;   |

&#x20;   +---- Denied -----> Authorization Error



The backend remains authoritative.



19\. UI Authorization



The UI may use permissions to:



Hide unavailable menu items

Disable unavailable actions

Hide restricted buttons

Improve user experience



However:



UI authorization != security enforcement



Every protected backend operation must perform server-side authorization checks.



A malicious client must not be able to bypass authorization by calling the API directly.



20\. API Authorization



Protected API endpoints must declare the required authorization capability.



Conceptually:



GET /invoices

&#x20;   |

&#x20;   +---- invoice.read



POST /invoices

&#x20;   |

&#x20;   +---- invoice.create



POST /invoices/:id/approve

&#x20;   |

&#x20;   +---- invoice.approve



The exact API authorization mechanism will be finalized during API security implementation.



21\. Database Model



The authorization foundation is expected to contain the following conceptual tables:



security.roles

security.permissions

security.role\_permissions

security.user\_roles



The user role assignment must also carry company scope.



The final migration will establish the exact columns, constraints, indexes, and foreign keys.



22\. Roles Table



Conceptual structure:



security.roles



id

code

name

description

status

created\_at

updated\_at



Role code must be unique.



Role name should be human-readable.



Role status controls whether the role is active.



23\. Permissions Table



Conceptual structure:



security.permissions



id

code

name

description

created\_at

updated\_at



Permission code must be unique.



Permission codes are stable system identifiers.



24\. Role Permissions Table



Conceptual structure:



security.role\_permissions



role\_id

permission\_id

created\_at



The database must enforce:



UNIQUE(role\_id, permission\_id)



This prevents duplicate permission assignments.



25\. User Roles Table



Conceptual structure:



security.user\_roles



id

user\_id

company\_id

role\_id

status

created\_at

updated\_at



The assignment must be scoped to a company.



The database must prevent duplicate active assignments for the same user, company, and role.



26\. Foreign Key Relationships



The authorization model will connect to the existing identity and Core Platform models:



security.users

&#x20;      |

&#x20;      v

security.user\_roles

&#x20;      |

&#x20;      +------ security.roles

&#x20;      |

&#x20;      +------ core.companies



security.roles

&#x20;      |

&#x20;      v

security.role\_permissions

&#x20;      |

&#x20;      v

security.permissions



Foreign keys must enforce referential integrity.



27\. Delete Behavior



Authorization records represent security configuration.



Destructive cascading deletes should be used carefully.



The preferred production strategy is to deactivate authorization records rather than physically delete historical security configuration.



Foreign key delete behavior must therefore be explicitly designed rather than relying on implicit database behavior.



28\. Audit Requirements



Authorization changes are security-sensitive.



Future audit logging must capture important changes such as:



Role creation

Role modification

Role deactivation

Permission creation

Permission modification

Permission assignment

Permission removal

User role assignment

User role removal

Company-scoped authorization changes



Audit implementation will be handled by the Core Platform audit foundation.



29\. Security Requirements



Authorization implementation must address:



Server-side enforcement

Company isolation

Organization context validation

Least privilege

Separation of duties

Secure role assignment

Secure permission assignment

Authorization failure handling

Audit logging

Administrative access control

Protection against privilege escalation

30\. Least Privilege



Users should receive only the permissions required for their responsibilities.



Example:



Warehouse User

&#x20;   |

&#x20;   +---- warehouse\_stock.read

&#x20;   +---- warehouse\_stock.adjust



The user should not automatically receive:



finance.payment.approve



unless that capability is explicitly required and assigned.



31\. Privilege Escalation Protection



Users must not be allowed to modify their own roles or permissions unless they possess an explicitly authorized administrative capability.



Authorization administration must itself be protected by authorization rules.



The system must never trust role or permission information supplied by the client.



32\. Multi-Company Users



EnterpriseX must support users operating across multiple companies.



Example:



User

&#x20;|

&#x20;+---- Company A

&#x20;|       |

&#x20;|       +---- Finance User

&#x20;|

&#x20;+---- Company B

&#x20;|       |

&#x20;|       +---- Finance Manager

&#x20;|

&#x20;+---- Company C

&#x20;        |

&#x20;        +---- Reporting User



The active company context determines which role assignments apply.



33\. Inactive Access



A user-company-role assignment can be deactivated.



An inactive assignment must not grant permissions.



Example:



User

&#x20;|

&#x20;+---- Company A

&#x20;       |

&#x20;       +---- Finance User

&#x20;               |

&#x20;               +---- INACTIVE



The role remains defined, but this particular assignment does not grant access.



34\. Permission Resolution



Effective permissions are derived from:



User

&#x20;+

Active Company

&#x20;+

Active User Roles

&#x20;+

Active Role Permissions



Conceptually:



Effective Permissions

=

User

\+

Company Context

\+

Active Roles

\+

Role Permissions



Permissions outside the active company scope must not be included.



35\. Authorization Failure



When a user is authenticated but lacks the required permission, the backend must reject the operation.



Authentication failure and authorization failure must remain conceptually separate.



401

=

Not authenticated



403

=

Authenticated but not authorized



The exact API error contract will be defined during API foundation implementation.



36\. Performance



Authorization checks will occur frequently.



The implementation should therefore support efficient lookup through appropriate database indexes and controlled permission resolution.



Premature caching should not be introduced until performance requirements justify it.



Any future authorization cache must include safe invalidation behavior when roles or permissions change.



37\. Testing Requirements



The authorization foundation must eventually test:



Role creation

Permission creation

Role-permission assignment

Duplicate permission prevention

User-role assignment

Duplicate role assignment prevention

Company-scoped roles

Multi-company users

Inactive roles

Inactive assignments

Permission resolution

Unauthorized API access

Privilege escalation prevention

Company isolation

Organization/company integrity

Administrative authorization

Audit integration

38\. Migration Strategy



Authorization tables will be introduced through a new migration.



The migration must be additive.



Existing migrations must remain unchanged.



The migration must include:



Required schemas

Tables

Primary keys

Foreign keys

Unique constraints

Check constraints

Indexes



Migration execution must use the existing EnterpriseX migration runner.



No manual production schema changes are permitted.



39\. Backward Compatibility



The authorization foundation must not break:



Existing users

Existing organization records

Existing company records

Existing user-company access

Existing migrations

Existing API health functionality



Authorization functionality will initially be additive.



40\. Rollback Strategy



Before production authorization data exists, the migration could theoretically be reversed.



After production security configuration exists, destructive rollback must not be performed automatically.



The preferred approach is a corrective forward migration.



Security configuration must not be silently deleted.



41\. Dependencies



Authorization depends on:



PostgreSQL

Core schema

Organizations

Companies

Security users

User company access

Migration tracking



Future dependencies include:



Authentication

API authorization middleware

Audit logging

ERP module permissions

42\. Cross-Module Authorization Contract



Each future EnterpriseX module must define:



Module

&#x20; |

&#x20; +---- Resource

&#x20; |

&#x20; +---- Actions

&#x20; |

&#x20; +---- Permissions

&#x20; |

&#x20; +---- Protected API operations



Example:



Finance

&#x20;|

&#x20;+---- Invoice

&#x20;       |

&#x20;       +---- invoice.read

&#x20;       +---- invoice.create

&#x20;       +---- invoice.update

&#x20;       +---- invoice.approve



Modules own the business meaning of their permissions.



Security \& Identity owns the authorization framework.



43\. Permission Ownership



The module that owns a business capability should define the permissions required for that capability.



For example:



Finance

&#x20;   |

&#x20;   +---- invoice.read

&#x20;   +---- invoice.create

&#x20;   +---- invoice.approve



Security \& Identity provides the mechanism for assigning and evaluating those permissions.



This prevents the authorization system from becoming tightly coupled to individual business modules.



44\. Administrative Authorization



Authorization administration must itself be protected.



Examples:



role.create

role.update

role.assign



permission.read

permission.assign



Only appropriately authorized administrators should be able to perform these operations.



No user should automatically receive authorization administration privileges.



45\. Initial Scope



The initial authorization implementation will establish:



Roles

Permissions

Role permissions

Company-scoped user roles

Referential integrity

Uniqueness constraints

Status controls

Required indexes



The initial implementation will NOT establish:



Role hierarchy

Direct user permissions

Advanced policy engines

Attribute-based access control

External authorization engines

Authorization caching

Complex workflow authorization



Those capabilities require separate architectural review.



46\. Future Extension



The architecture must remain extensible toward:



RBAC

&#x20;|

&#x20;+---- Company Scope

&#x20;|

&#x20;+---- Organization Scope

&#x20;|

&#x20;+---- Module Permissions

&#x20;|

&#x20;+---- Approval Permissions

&#x20;|

&#x20;+---- Separation of Duties

&#x20;|

&#x20;+---- Future Policy Controls



Future extensions must preserve the core principle:



Business authorization must be explicit,

auditable, testable, and enforced server-side.

47\. Architectural Principle



EnterpriseX authorization is based on:



WHO ARE YOU?

&#x20;    ↓

Identity



HOW DO YOU PROVE IT?

&#x20;    ↓

Authentication



WHERE CAN YOU OPERATE?

&#x20;    ↓

Organization / Company Access



WHAT CAN YOU DO?

&#x20;    ↓

Role



WHAT DOES THE ROLE ALLOW?

&#x20;    ↓

Permission



The final authorization decision is made by the backend.



The database provides the authoritative security relationships.



The UI provides user experience but is never the security boundary.



48\. Definition of Done



The authorization foundation is complete only when:



Roles are implemented

Permissions are implemented

Role-permission relationships are implemented

User-role relationships are implemented

Company scope is enforced

Database constraints are implemented

Required indexes exist

Migration is idempotent

Database integrity is tested

Authorization documentation exists

API authorization integration is defined

Security requirements are documented

Audit requirements are documented

Automated tests are implemented

No existing foundation functionality is broken

Changes are committed to Git

