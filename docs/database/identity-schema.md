\# EnterpriseX Identity Database Architecture



\## 1. Purpose



This document defines the foundational Security \& Identity database model for EnterpriseX.



The model establishes canonical users, authentication credentials, and organization/company access.



The design intentionally separates identity, authentication, authorization, and organizational context.



\---



\## 2. Ownership



The Security \& Identity domain owns:



\- User identity

\- Authentication credentials

\- User organization/company access



The Core Platform owns:



\- Organizations

\- Companies



Authorization roles and permissions will be implemented separately.



\---



\## 3. Identity Architecture



```text

User

&#x20;|

&#x20;+---- Credentials

&#x20;|

&#x20;+---- Organization/Company Access

&#x20;|

&#x20;+---- Roles

&#x20;       |

&#x20;       +---- Permissions



| Field          | Type         | Required | Purpose                    |

| -------------- | ------------ | -------: | -------------------------- |

| `id`           | UUID         |      Yes | Stable internal identifier |

| `email`        | VARCHAR(320) |      Yes | Unique user identity       |

| `display\_name` | VARCHAR(255) |      Yes | Human-readable name        |

| `status`       | VARCHAR(20)  |      Yes | User lifecycle state       |

| `created\_at`   | TIMESTAMPTZ  |      Yes | Creation timestamp         |

| `updated\_at`   | TIMESTAMPTZ  |      Yes | Update timestamp           |

Allowed user statuses:



ACTIVE

INACTIVE

LOCKED

5\. Email Uniqueness



User email addresses are currently globally unique.



The authentication layer will be responsible for consistent email normalization and case handling

6\. security.user\_credentials



Authentication credentials are stored separately from user identity.



The system must never store plaintext passwords.



Field	Type	Purpose

user\_id	UUID	User identity

password\_hash	VARCHAR(255)	One-way password hash

password\_changed\_at	TIMESTAMPTZ	Password lifecycle

failed\_login\_attempts	INTEGER	Failed authentication counter

locked\_until	TIMESTAMPTZ	Temporary account lock

last\_login\_at	TIMESTAMPTZ	Last successful login

created\_at	TIMESTAMPTZ	Creation timestamp

updated\_at	TIMESTAMPTZ	Update timestamp



Passwords must never be stored in plaintext, logs, API responses, analytics, or audit records.



7\. security.user\_company\_access



This table defines where a user is permitted to operate.



Access answers:



Where can the user operate?



Authorization answers:



What can the user do?



These concepts remain separate.



8\. User Company Access Fields

Field	Type	Required	Purpose

id	UUID	Yes	Stable access record

user\_id	UUID	Yes	User

organization\_id	UUID	Yes	Organization context

company\_id	UUID	Yes	Company context

status	VARCHAR(20)	Yes	Access lifecycle

created\_at	TIMESTAMPTZ	Yes	Creation timestamp

updated\_at	TIMESTAMPTZ	Yes	Update timestamp



Allowed access statuses:



ACTIVE

INACTIVE

9\. Relationships

core.organizations

&#x20;       |

&#x20;       +---- core.companies

&#x20;                 |

&#x20;                 |

&#x20;       security.user\_company\_access

&#x20;                 |

&#x20;                 |

&#x20;           security.users

&#x20;                 |

&#x20;                 |

&#x20;       security.user\_credentials



A user may have access to multiple companies.



A company may have multiple users.



10\. Access Uniqueness



The same user cannot have duplicate access records for the same company.



The database enforces uniqueness using:



(user\_id, company\_id)

11\. Organization / Company Integrity



The access record contains:



organization\_id

company\_id



The application must ensure that the selected company belongs to the selected organization.



A future database-level composite relationship may strengthen this invariant if required by the architecture.



12\. Authentication Boundary



Authentication belongs to Security \& Identity.



Future authentication flow:



Login Request

&#x20;     |

&#x20;     v

Identity Lookup

&#x20;     |

&#x20;     v

Credential Verification

&#x20;     |

&#x20;     v

Account Status Check

&#x20;     |

&#x20;     v

Authentication Success

&#x20;     |

&#x20;     v

Session / Token

&#x20;     |

&#x20;     v

Organization + Company Context



The exact session/token architecture will be finalized during authentication implementation.



13\. Authorization Boundary



Roles and permissions are intentionally NOT implemented in migration 004.



Future architecture:



User

&#x20;|

&#x20;+---- Company Access

&#x20;|

&#x20;+---- Role Assignment

&#x20;            |

&#x20;            +---- Permission Assignment



Roles and permissions will be implemented as a separate foundation step.



14\. User Provisioning



Unauthenticated public user registration is not part of the initial ERP architecture.



Future user creation must be controlled through:



Authorized administrators

Secure provisioning workflows

Enterprise identity providers where applicable

Authentication policies

15\. Security Requirements



Future authentication implementation must address:



Password hashing

Authentication failure handling

Account lockout

Session/token security

Credential rotation

Secure password reset

Authentication logging

Sensitive-data protection

Rate limiting

Authorization

Organization/company isolation

16\. Migration



The identity schema is introduced by:



database/migrations/004\_create\_identity\_schema.sql



Migration sequence:



001 Core Schema

002 Migration Tracking

003 Organization \& Company

004 Identity Schema



Migration 004 creates:



security.users

security.user\_credentials

security.user\_company\_access

17\. Dependencies



Identity depends on:



PostgreSQL

Core schema

core.organizations

core.companies

Migration tracking



Future roles and permissions will depend on this identity foundation.



18\. Backward Compatibility



Migration 004 is additive.



It does not modify existing organization or company records.



Existing migrations remain valid.



No existing ERP transaction data is modified.



19\. Rollback



Before dependent production data exists, the migration could theoretically be reversed.



Once dependent production records exist, destructive rollback must not be performed automatically.



The preferred production strategy is:



Forward-compatible corrective migration



rather than destructive deletion.



20\. Testing Requirements



The identity model must eventually test:



User creation

Email uniqueness

User status validation

Credential relationship

Password hash persistence

Failed login tracking

Account locking

User/company access

Duplicate access prevention

Organization/company integrity

Multi-company users

Inactive access

Authorization integration



The initial database integrity test successfully verified:



User

&#x20;↓

Organization

&#x20;↓

Company

&#x20;↓

User Company Access



The test transaction was rolled back so that no test data remains.



21\. Architectural Principle



EnterpriseX separates:



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

Roles \& Permissions



These concepts must not be collapsed into one database table or one authorization mechanism.







