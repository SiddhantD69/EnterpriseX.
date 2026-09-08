\# EnterpriseX Core Audit Database Architecture



\## 1. Purpose



This document defines the foundational audit model for EnterpriseX.



The audit foundation records important system and business activity so that EnterpriseX can answer:



\- Who performed an action?

\- What action occurred?

\- When did it occur?

\- Which organization and company context was active?

\- Which entity or record was affected?

\- What changed?

\- From where did the request originate?

\- Was the operation successful or failed?



Audit data supports security, compliance, troubleshooting, operational investigation, and accountability.



\---



\## 2. Ownership



The Core Platform owns:



\- Audit event infrastructure

\- Audit record storage

\- Audit event lifecycle

\- Audit context

\- Audit querying infrastructure

\- Audit retention configuration



Security \& Identity owns:



\- Authentication events

\- Authorization/security events

\- Security-sensitive audit requirements



Business modules own:



\- Business meaning of audited events

\- Which business operations require audit events

\- Business-specific audit metadata



\---



\## 3. Audit Principles



EnterpriseX audit records must be:



\- Immutable

\- Traceable

\- Timestamped

\- Actor-aware where applicable

\- Organization/company-aware where applicable

\- Machine-readable

\- Searchable

\- Secure

\- Consistent

\- Suitable for investigation



Audit records must not be treated as ordinary application logs.



\---



\## 4. Audit vs Application Logging



EnterpriseX separates audit records from technical application logs.



\### Audit



Answers:



> What happened to the business/system state?



Examples:



```text

User role assigned

Invoice approved

Purchase order updated

Company configuration changed

User disabled

Application Logging



Answers:



What happened inside the software while processing a request?



Examples:



Database connection failed

HTTP request received

Unexpected exception

External service timeout



Application logs and audit records may reference the same request or correlation identifier, but they serve different purposes.



5\. Audit Event Model



Conceptually:



Actor

&#x20; |

&#x20; v

Action

&#x20; |

&#x20; v

Entity / Record

&#x20; |

&#x20; v

Change

&#x20; |

&#x20; v

Audit Event

&#x20; |

&#x20; +---- Organization

&#x20; +---- Company

&#x20; +---- Timestamp

&#x20; +---- Request Context

6\. Actor



The actor identifies who or what caused an operation.



Typical actor types:



USER

SYSTEM

SERVICE

INTEGRATION



A human user should reference security.users when available.



System-generated operations may not have a user.



Integration-generated operations may identify the originating integration/service.



7\. Actor Identity



Audit records should preserve the stable internal user identifier when the actor is a user.



The user's display name or email should not be treated as the permanent audit identity because those values can change.



The stable user UUID is the authoritative actor reference.



8\. Action



Every audit event must identify the action that occurred.



Examples:



CREATE

UPDATE

DELETE

LOGIN

LOGOUT

LOGIN\_FAILED

ASSIGN\_ROLE

REMOVE\_ROLE

APPROVE

REJECT

POST

CANCEL

CONFIGURE



The action vocabulary should remain controlled and documented.



Business modules may define additional business actions when required.



9\. Entity Type



An audit event identifies the type of entity affected.



Examples:



USER

ROLE

PERMISSION

COMPANY

CONFIGURATION

INVOICE

PURCHASE\_ORDER

WAREHOUSE\_STOCK

SALES\_ORDER



Entity types should use stable machine-readable identifiers.



10\. Entity Identifier



When an individual record is affected, the audit event should contain the stable identifier of that record.



Conceptually:



entity\_type = INVOICE

entity\_id   = invoice UUID



This allows investigators to trace activity back to the affected record.



11\. Record Changes



For operations that change data, audit events may capture before and after state.



Conceptually:



Before

&#x20;  ↓

Action

&#x20;  ↓

After



Example:



{

&#x20; "status": "DRAFT"

}



becomes:



{

&#x20; "status": "APPROVED"

}



Before/after data must be handled carefully to prevent sensitive information from being exposed.



12\. Change Representation



The initial audit model will support structured JSON metadata for change information.



Potential fields include:



before\_data

after\_data

changes

metadata



The exact content depends on the audited operation.



The audit system must not automatically capture every database column without considering security, privacy, and storage impact.



13\. Sensitive Data



Sensitive information must not be blindly copied into audit records.



Examples requiring protection include:



Passwords

Password hashes

Authentication tokens

API secrets

Private keys

Encryption keys

Payment credentials

Other confidential security material



Audit implementations must explicitly exclude protected fields.



14\. Organization Context



Where applicable, audit events should identify the organization context.



Conceptually:



organization\_id



This allows audit searches to be scoped to an organization.



System-level events may have no organization.



15\. Company Context



Where applicable, audit events should identify the active company context.



Conceptually:



company\_id



This is particularly important for ERP business transactions.



A user's activity in Company A must not be confused with activity in Company B.



16\. Request Context



Audit events should support request-level tracing.



Important contextual information may include:



request\_id

correlation\_id

session\_id

source

ip\_address

user\_agent



The initial implementation should store only the information justified by security, compliance, and operational requirements.



17\. Timestamp



Every audit event must have an authoritative creation timestamp.



The database should generate the timestamp by default.



Audit timestamps should use:



TIMESTAMPTZ



This preserves timezone-aware event timing.



UTC should be used as the canonical storage/reference convention.



18\. Success and Failure



Audit events may represent both successful and failed security-sensitive operations.



For example:



LOGIN\_SUCCESS

LOGIN\_FAILED



For ordinary business operations, the audit record should normally represent a successfully committed business action.



Technical failures belong primarily in application logs unless the failed operation itself is security-sensitive or compliance-relevant.



19\. Audit Event Status



Where required, an audit event may indicate:



SUCCESS

FAILURE



The meaning must be documented by the event producer.



Audit status must not be confused with the business status of the affected entity.



20\. Audit Database Model



The initial audit foundation will contain:



core.audit\_events



The table stores the authoritative audit event record.



21\. Audit Events Table



Conceptual structure:



core.audit\_events



id

occurred\_at

actor\_type

actor\_user\_id

organization\_id

company\_id

action

entity\_type

entity\_id

request\_id

correlation\_id

status

source

ip\_address

user\_agent

before\_data

after\_data

metadata



The final migration will define exact database types, constraints, indexes, and foreign keys.



22\. Audit Event ID



Every audit event requires a stable UUID.



Conceptually:



id UUID PRIMARY KEY



The identifier is used for:



Investigation

Cross-system references

Support operations

Correlation

Future integrations

23\. Actor Type Constraint



The database should restrict actor types to the supported initial vocabulary:



USER

SYSTEM

SERVICE

INTEGRATION



New actor types require architectural review.



24\. Action Constraint



The initial database should validate that an action is present.



The complete business action catalogue should remain extensible rather than embedding every future module action into a database CHECK constraint.



This avoids requiring a database migration for every new business action.



25\. Entity Type



Entity type must be required for record-oriented audit events.



The architecture should allow system-level events where an entity may not exist.



Therefore entity identification rules depend on the type of audit event.



26\. Actor User Relationship



When:



actor\_type = USER



the audit record should reference:



security.users.id



When:



actor\_type = SYSTEM



the user reference may be NULL.



Service and integration actors may use additional metadata or future identity references.



27\. Organization Relationship



When an audit event occurs within an organization context, the event should reference:



core.organizations.id



The relationship must preserve referential integrity where the organization exists.



28\. Company Relationship



When an audit event occurs within a company context, the event should reference:



core.companies.id



The company must belong to the expected organization context.



Application-level validation will initially enforce the organization/company consistency rule.



29\. Delete Behavior



Audit records are historical records.



They must not disappear because a related business entity is deleted.



Foreign-key behavior must therefore be designed to preserve audit history.



The preferred approach is to avoid destructive cascading deletes from business entities into audit records.



Where appropriate, nullable references or controlled retention mechanisms should be used.



30\. Immutability



Audit records should be append-oriented.



After creation:



Audit Event

&#x20;    |

&#x20;    +---- MUST NOT be modified as ordinary application data



The system should not provide ordinary update or delete operations for audit events.



Corrections should be represented through additional audit events or controlled administrative procedures.



31\. Database Permissions



Ordinary application users must not have direct write access to audit tables.



Audit writes should occur through controlled backend services or database mechanisms defined by the architecture.



Direct client access to audit tables is prohibited.



32\. Audit API Boundary



The desktop application must not access the audit database directly.



Future audit APIs may support authorized operations such as:



Search audit events

View audit event

Filter by user

Filter by company

Filter by entity

Filter by action

Filter by date range



Creating audit events should normally be an internal backend responsibility.



33\. Audit Service



The Core Platform should provide a centralized audit service.



Conceptually:



Business Operation

&#x20;     |

&#x20;     v

Application Service

&#x20;     |

&#x20;     +---- Business Transaction

&#x20;     |

&#x20;     +---- Audit Event



The audit service provides consistent event construction and persistence.



34\. Transactional Behavior



For important business operations, the audit event should be created consistently with the business transaction.



The architecture must prevent a successful business operation from appearing unaudited merely because the audit write silently failed.



The exact transactional strategy will be finalized during implementation.



35\. Audit Failure Handling



Audit failures are security and operationally important.



The system must define whether an operation:



FAILS



or:



CONTINUES WITH ALERTING



when audit persistence fails.



The policy may differ between:



Security events

Financial transactions

Operational events

Informational events



This must be explicitly defined by the owning domain.



36\. Financial Audit



Financial operations require strong auditability.



Examples:



Invoice creation

Invoice modification

Invoice approval

Invoice posting

Payment approval

Journal posting

Period closing



Finance will define which events are mandatory.



The audit foundation provides the infrastructure.



37\. Security Audit



Security-sensitive events should be audited.



Examples:



Login success

Login failure

Password change

Password reset

Account lock

Role assignment

Role removal

Permission assignment

Authorization administration



Security \& Identity will define the detailed security event catalogue.



38\. Configuration Audit



Configuration changes should be audited.



Examples:



Configuration created

Configuration updated

Configuration overridden

Configuration reset

Configuration disabled



Sensitive configuration values must not be exposed in audit records.



39\. Audit Search



Audit records should support efficient investigation.



Common filters include:



Date range

User

Organization

Company

Action

Entity type

Entity ID

Status

Request ID

Correlation ID

Source



Indexes should support common access patterns.



40\. Indexing Strategy



The initial audit schema should include indexes for likely investigation queries.



Expected indexes include:



occurred\_at

actor\_user\_id

organization\_id

company\_id

action

entity\_type + entity\_id

request\_id

correlation\_id



Indexing must be balanced against audit write volume.



41\. Storage Growth



Audit tables may become very large.



The architecture must anticipate long-term growth.



Future strategies may include:



Partitioning

Archival

Retention policies

Cold storage

Separate analytical copies



These should be introduced based on measured scale rather than prematurely.



42\. Retention



Audit retention requirements depend on:



Security requirements

Regulatory requirements

Business requirements

Storage constraints

Legal requirements



The Core Platform should provide the foundation for controlled retention.



No automatic destructive retention policy should be introduced until requirements are defined.



43\. Privacy



Audit data may contain personal or sensitive information.



The audit architecture must follow applicable privacy requirements.



Access to audit data must be restricted.



Audit records must not become a secondary uncontrolled copy of confidential business data.



44\. Audit and Authorization



Viewing audit information is itself an authorized operation.



Example permissions:



audit.read

audit.search

audit.export



Only appropriately authorized users should access audit records.



Security-sensitive audit data may require additional restrictions.



45\. Audit Export



Future audit export may support:



CSV

JSON

PDF



Export must respect:



Authorization

Company scope

Organization scope

Data privacy

Sensitive-field protection

Audit logging of the export itself



Export implementation is outside the initial database foundation.



46\. Cross-Module Audit Contract



Every business module should define:



Event Name

Action

Entity Type

Entity ID

Actor Context

Organization Context

Company Context

Business Meaning

Sensitive Fields

Audit Requirement



Example:



Finance

&#x20;|

&#x20;+---- Invoice Approved

&#x20;       |

&#x20;       +---- action = APPROVE

&#x20;       +---- entity\_type = INVOICE

&#x20;       +---- entity\_id = invoice UUID

&#x20;       +---- company\_id = company UUID

47\. Audit Event Naming



Business audit event names should be stable and machine-readable.



The event should clearly represent the operation.



Examples:



USER\_CREATED

USER\_DISABLED

ROLE\_ASSIGNED

INVOICE\_APPROVED

PURCHASE\_ORDER\_CREATED

SALES\_ORDER\_CANCELLED



The initial database does not need a separate event catalogue table.



A future centralized event registry may be introduced if justified.



48\. Observability Relationship



Audit, application logs, and metrics should be connected through correlation identifiers where practical.



Conceptually:



Request

&#x20;|

&#x20;+---- request\_id

&#x20;|

&#x20;+---- correlation\_id

&#x20;|

&#x20;+---- Application Logs

&#x20;|

&#x20;+---- Audit Event

&#x20;|

&#x20;+---- Metrics



This enables investigation across technical and business layers.



49\. Security Requirements



The audit foundation must address:



Access control

Immutability

Sensitive-data protection

Secure storage

Company isolation

Organization isolation

Audit access logging

Retention

Privacy

Administrative controls

Reliable persistence

50\. Testing Requirements



The audit foundation must eventually test:



Audit event creation

User actor relationship

System actor

Organization context

Company context

Entity identification

Action recording

Timestamp generation

Before/after data

Metadata

Request correlation

Audit authorization

Immutability

Sensitive-field exclusion

Company isolation

Organization isolation

Transaction behavior

Audit failure handling

Index effectiveness

51\. Migration Strategy



The audit table will be introduced through a new database migration.



The migration must be additive.



Existing migrations must remain unchanged.



The migration must use the existing EnterpriseX migration runner.



No manual production schema changes are permitted.



52\. Backward Compatibility



The audit foundation must not break:



Existing organizations

Existing companies

Existing users

Existing roles

Existing permissions

Existing configuration

Existing API functionality

Existing migrations



The audit foundation is additive.



53\. Rollback Strategy



Before production audit records exist, the migration could theoretically be reversed.



Once audit history exists, destructive rollback should not be used.



The preferred approach is a corrective forward migration.



Historical audit records must not be silently destroyed.



54\. Dependencies



The audit foundation depends on:



PostgreSQL

Core schema

Organizations

Companies

Security users

Migration tracking



Future dependencies include:



Authorization

API request context

Business modules

Application logging

Observability

55\. Initial Scope



The initial audit database foundation will establish:



Audit event table

Actor information

Organization context

Company context

Action

Entity information

Status

Timestamp

Request/correlation identifiers

Structured before/after data

Metadata

Security-related constraints

Investigation indexes



The initial implementation will NOT establish:



Automatic database triggers on every table

Advanced event streaming

Distributed event sourcing

Long-term archival infrastructure

Automated retention deletion

External SIEM integration



Those capabilities require separate architectural review.



56\. Why Automatic Triggers Are Not Initial



EnterpriseX will not initially place database triggers on every business table to automatically generate audit records.



Automatic triggers can:



Hide business meaning

Create excessive audit volume

Capture irrelevant changes

Complicate transactions

Make module ownership unclear

Increase database coupling



Business-level audit events should normally be created by application services that understand the meaning of the operation.



Database triggers may be introduced later for narrowly defined requirements.



57\. Business Meaning



Audit events should represent meaningful business or security actions rather than merely low-level SQL operations.



Prefer:



INVOICE\_APPROVED



over:



UPDATE invoices SET status = 'APPROVED'



The audit record should explain what happened in business terms.



58\. Audit Record Example



Conceptually:



{

&#x20; "actor\_type": "USER",

&#x20; "actor\_user\_id": "user-uuid",

&#x20; "organization\_id": "organization-uuid",

&#x20; "company\_id": "company-uuid",

&#x20; "action": "APPROVE",

&#x20; "entity\_type": "INVOICE",

&#x20; "entity\_id": "invoice-uuid",

&#x20; "status": "SUCCESS",

&#x20; "before\_data": {

&#x20;   "status": "DRAFT"

&#x20; },

&#x20; "after\_data": {

&#x20;   "status": "APPROVED"

&#x20; }

}



The actual implementation will use real UUIDs and database timestamps.



59\. Definition of Done



The audit foundation is complete only when:



Audit table is implemented

Actor model is implemented

Organization/company context is supported

Entity identification is supported

Action is recorded

Timestamp is authoritative

Structured change data is supported

Sensitive data boundaries are defined

Immutability requirements are defined

Required indexes exist

Referential integrity is implemented where appropriate

Migration is idempotent

Database integrity is tested

Audit authorization is defined

Transaction behavior is defined

Documentation exists

Existing foundation functionality remains intact

Changes are committed to Git

