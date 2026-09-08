\# EnterpriseX Core Configuration Database Architecture



\## 1. Purpose



This document defines the foundational configuration model for EnterpriseX.



The configuration foundation provides a controlled mechanism for storing and resolving system, organization, and company configuration.



Configuration must remain separate from business transaction data.



The configuration system exists to control how EnterpriseX operates without embedding environment-specific or company-specific values directly into application code.



\---



\## 2. Ownership



The Core Platform owns:



\- Configuration definitions

\- Configuration values

\- Configuration scopes

\- Configuration validation

\- Configuration resolution

\- Configuration lifecycle



Business modules own:



\- Module-specific configuration definitions

\- Module-specific configuration meaning

\- Module-specific default values where applicable



Security \& Identity owns:



\- Authentication and authorization security policies

\- Credential-related configuration



Sensitive configuration must follow the security architecture and must not be exposed through ordinary configuration APIs.



\---



\## 3. Configuration Principles



EnterpriseX configuration follows these principles:



\- Configuration is data, not application code.

\- Configuration must have a defined owner.

\- Configuration must have a defined scope.

\- Configuration must have a defined data type.

\- Configuration values must be validated.

\- Defaults must be explicit.

\- Company-level overrides must not modify global defaults.

\- Configuration changes must be auditable.

\- Business transactions must not be stored as configuration.

\- Secrets must not be stored as ordinary configuration values.

\- Configuration resolution must be deterministic.



\---



\## 4. Configuration Scope



EnterpriseX will initially support three configuration scopes:



```text

SYSTEM

&#x20; |

&#x20; +---- ORGANIZATION

&#x20;         |

&#x20;         +---- COMPANY

SYSTEM



System configuration applies to the EnterpriseX installation/environment.



Examples:



Application-level behavior

Global feature configuration

Platform defaults

ORGANIZATION



Organization configuration applies to an EnterpriseX organization.



Examples:



Organization-wide business settings

Organization defaults

Organization policies

COMPANY



Company configuration applies to one specific company.



Examples:



Company-specific operational settings

Company-specific defaults

Company-specific business behavior

5\. Configuration Resolution



When a configuration value is requested, EnterpriseX resolves the most specific applicable value.



Conceptually:



COMPANY

&#x20;  ↓

ORGANIZATION

&#x20;  ↓

SYSTEM

&#x20;  ↓

DEFAULT



If a company-specific value exists, it takes precedence over the organization value.



If no company value exists, the organization value is considered.



If no organization value exists, the system value is considered.



If no scoped value exists, the defined default is used.



6\. Configuration Ownership



Every configuration key must have a defined owner.



Examples:



core

security

finance

procurement

warehouse

sales

manufacturing

hr

crm

analytics



The owning module is responsible for the business meaning of its configuration.



The Core Platform provides the storage and resolution mechanism.



7\. Configuration Keys



Configuration is identified by a stable key.



Recommended naming convention:



<module>.<domain>.<setting>



Examples:



core.company.default\_currency

core.company.timezone



finance.invoice.payment\_terms

finance.invoice.approval\_required



warehouse.inventory.negative\_stock\_allowed



sales.order.credit\_check\_required



Configuration keys must be:



Unique

Stable

Machine-readable

Human understandable

Independent from UI labels

8\. Configuration Definition



A configuration definition describes what a configuration setting means.



Conceptually:



Configuration Definition

&#x20;|

&#x20;+---- Key

&#x20;+---- Name

&#x20;+---- Description

&#x20;+---- Owner Module

&#x20;+---- Data Type

&#x20;+---- Default Value

&#x20;+---- Status



The definition establishes the contract for configuration values.



9\. Configuration Value



A configuration value represents the actual value for a particular scope.



Conceptually:



Configuration Definition

&#x20;       |

&#x20;       v

Configuration Value

&#x20;       |

&#x20;       +---- Scope

&#x20;       +---- Scope ID

&#x20;       +---- Value



The same configuration definition may have different values at different scopes.



10\. Data Types



The initial configuration model will support explicit data types.



Initial supported types:



STRING

INTEGER

DECIMAL

BOOLEAN

DATE

DATETIME

JSON



The configuration definition determines which type is valid.



The application must validate the supplied value against the declared type.



11\. Default Values



Configuration definitions may define a default value.



The default value is used when no applicable scoped value exists.



Conceptually:



Company Value

&#x20;     ↓

Organization Value

&#x20;     ↓

System Value

&#x20;     ↓

Default Value



Defaults must be deterministic and documented.



12\. Null and Missing Values



A missing configuration value and an explicit value must not be treated as the same concept without architectural justification.



The resolution layer must clearly distinguish:



No override exists



from:



An explicit configured value exists



Configuration semantics must be defined by the owning module where null has business meaning.



13\. Configuration Scope Identity



Scoped configuration values require a scope identifier.



Conceptually:



SYSTEM

&#x20; scope\_id = NULL



ORGANIZATION

&#x20; scope\_id = organization UUID



COMPANY

&#x20; scope\_id = company UUID



The application must validate that the scope identifier matches the declared scope.



14\. System Scope



System-level configuration applies to the EnterpriseX environment.



System configuration must not require an organization or company identifier.



Conceptually:



scope\_type = SYSTEM

scope\_id   = NULL

15\. Organization Scope



Organization-level configuration applies to a specific organization.



Conceptually:



scope\_type = ORGANIZATION

scope\_id   = organization UUID



The referenced organization must exist.



16\. Company Scope



Company-level configuration applies to a specific company.



Conceptually:



scope\_type = COMPANY

scope\_id   = company UUID



The referenced company must exist.



The application must also validate that the company belongs to the expected organization context.



17\. Database Model



The initial configuration foundation is expected to contain:



core.configuration\_definitions

core.configuration\_values



The definition table stores the configuration contract.



The value table stores scoped configuration values.



18\. Configuration Definitions Table



Conceptual structure:



core.configuration\_definitions



id

key

name

description

owner\_module

data\_type

default\_value

status

created\_at

updated\_at



The configuration key must be unique.



The owner module identifies which module owns the business meaning.



19\. Configuration Values Table



Conceptual structure:



core.configuration\_values



id

configuration\_definition\_id

scope\_type

scope\_id

value

created\_at

updated\_at



A configuration value belongs to exactly one configuration definition.



The combination of configuration definition and scope must be unique.



20\. Scope Uniqueness



EnterpriseX must not allow duplicate configuration values for the same configuration definition and scope.



Conceptually:



(configuration\_definition\_id, scope\_type, scope\_id)



must uniquely identify a configuration value.



System-level values require special handling because their scope identifier is NULL.



The database design must therefore implement system-scope uniqueness explicitly rather than relying on ordinary NULL uniqueness behavior.



21\. Configuration Status



Configuration definitions should support lifecycle management.



Initial statuses:



ACTIVE

INACTIVE



Inactive configuration definitions must not be used for normal configuration resolution.



Existing configuration values should be retained unless a controlled cleanup is explicitly required.



22\. Configuration Value Storage



The initial database implementation will use a controlled textual representation for configuration values.



The declared data type on the configuration definition determines how the value is interpreted and validated.



The application layer is responsible for:



Type validation

Parsing

Conversion

Business validation



The database remains responsible for structural integrity.



23\. JSON Configuration



JSON values may be used where a setting requires structured configuration.



Examples:



{

&#x20; "threshold": 10,

&#x20; "enabled": true

}



JSON configuration must still have a documented schema or validation contract when used by a production module.



JSON must not become a mechanism for storing arbitrary undocumented business data.



24\. Secrets



Sensitive secrets must NOT be stored as ordinary configuration values.



Examples include:



Database passwords

API secrets

Private keys

Encryption keys

Authentication secrets

OAuth client secrets



Secrets must be handled through a secure secret-management mechanism.



The configuration foundation may store references to secrets where required, but must not expose secret material through ordinary configuration APIs.



25\. Security



Configuration access must be authorized.



Not every authenticated user should be allowed to read or modify configuration.



Future configuration permissions may include:



configuration.read

configuration.create

configuration.update

configuration.disable



Module-specific configuration administration must also respect business authorization.



26\. Configuration API Boundary



The backend will expose configuration operations through application services.



Conceptual operations:



Get configuration

Set configuration

Update configuration

Reset configuration override

Resolve effective configuration



The desktop application must not access configuration tables directly.



All configuration access must go through the backend.



27\. Configuration Resolution Service



A centralized configuration resolution service should provide deterministic behavior.



Conceptual API:



resolve(key, companyContext)



Resolution:



1\. Company override

2\. Organization override

3\. System override

4\. Default value



The resolution logic must be implemented outside the UI.



28\. Configuration Override



A company or organization override changes the effective value for that scope only.



Example:



System:

finance.invoice.approval\_required = false



Company A:

finance.invoice.approval\_required = true



Effective result:



Company A = true

Other companies = false



Overrides must not modify the underlying system default.



29\. Resetting Overrides



A scope-specific override can be removed when the owning module allows it.



After removing an override, configuration resolution falls back to the next applicable scope.



Example:



Company

&#x20;  X override removed

&#x20;       ↓

Organization value

&#x20;       ↓

System value

&#x20;       ↓

Default



Reset behavior must be auditable.



30\. Configuration Validation



Configuration values must be validated before persistence.



Validation must include:



Required value rules

Data type

Allowed ranges

Allowed values

Format

Business constraints

Scope validity



Example:



finance.invoice.payment\_terms



may require:



INTEGER

>= 0



The owning module defines business-specific validation rules.



31\. Database Integrity



The database must enforce structural rules including:



Primary keys

Foreign keys

Unique configuration keys

Valid scope types

Valid data types

Valid statuses

Required fields

Appropriate indexes



Business validation remains in the application/domain layer.



32\. Audit Requirements



Configuration changes are security and operationally important.



Future audit logging must capture:



Configuration creation

Configuration update

Configuration deactivation

Configuration override

Configuration reset

Previous value where appropriate

New value where appropriate

Scope

User responsible

Timestamp



Sensitive secret values must never be written to audit logs.



33\. Versioning



Configuration definitions may evolve over time.



Changing a configuration key requires compatibility review.



Production configuration keys should not be renamed casually.



If a configuration key becomes obsolete, the preferred approach is controlled deprecation followed by a migration strategy.



34\. Module Integration



Business modules must define configuration contracts.



Example:



Finance

&#x20;|

&#x20;+---- finance.invoice.approval\_required

&#x20;|

&#x20;+---- finance.invoice.payment\_terms



The Finance module owns the meaning.



The Core Platform owns the configuration infrastructure.



This prevents business logic from becoming dependent on direct database access.



35\. Cross-Module Configuration Contract



Each module defining configuration must provide:



Configuration Key

Owner Module

Description

Data Type

Default Value

Allowed Values / Range

Scope

Security Classification

Validation Rules

Fallback Behavior



This contract becomes part of the module documentation.



36\. Performance



Configuration values may be requested frequently.



The first implementation should prioritize correctness and simple deterministic database resolution.



Caching should not be introduced prematurely.



If caching becomes necessary, it must include safe invalidation when configuration changes.



37\. Testing Requirements



The configuration foundation must eventually test:



Configuration definition creation

Unique configuration keys

Data type validation

Default values

System configuration

Organization configuration

Company configuration

Scope validation

Scope uniqueness

Configuration resolution

Override behavior

Override reset

Inactive definitions

Authorization

Audit integration

Secret protection

38\. Migration Strategy



Configuration tables will be introduced through a new database migration.



The migration must be additive.



Existing migrations must remain unchanged.



The migration must use the existing EnterpriseX migration runner.



No manual production schema changes are permitted.



39\. Backward Compatibility



The configuration foundation must not break:



Existing organizations

Existing companies

Existing users

Existing authorization

Existing migrations

Existing API functionality



The new configuration model is additive.



40\. Rollback Strategy



Before production configuration data exists, the migration could theoretically be reversed.



After configuration data is used by production modules, destructive rollback must not be performed automatically.



The preferred production approach is a corrective forward migration.



41\. Dependencies



Configuration depends on:



PostgreSQL

Core schema

Organizations

Companies

Migration tracking



Future configuration consumers include:



Finance

Procurement

Supply Chain

Warehouse

Sales

Manufacturing

HR

CRM

Analytics

Administration

42\. Initial Scope



The initial configuration foundation will establish:



Configuration definitions

Configuration values

System scope

Organization scope

Company scope

Configuration data types

Defaults

Scope-aware uniqueness

Status management

Required indexes

Referential integrity



The initial implementation will NOT establish:



Secret management

Advanced policy engines

Distributed configuration services

Configuration caching

Dynamic code execution

Arbitrary business-data storage



Those capabilities require separate architectural review.



43\. Architectural Principle



EnterpriseX configuration follows:



DEFINE

&#x20; ↓

Configuration Definition

&#x20; ↓

STORE

&#x20; ↓

Scoped Configuration Value

&#x20; ↓

RESOLVE

&#x20; ↓

Company

&#x20; ↓

Organization

&#x20; ↓

System

&#x20; ↓

Default

&#x20; ↓

VALIDATE

&#x20; ↓

USE

&#x20; ↓

Business Module



Configuration must remain:



Explicit

Typed

Scoped

Validated

Auditable

Secure

Deterministic

44\. Definition of Done



The configuration foundation is complete only when:



Configuration definitions are implemented

Configuration values are implemented

System scope is supported

Organization scope is supported

Company scope is supported

Scope uniqueness is enforced

Data types are defined

Defaults are supported

Configuration resolution is defined

Validation is implemented

Authorization requirements are defined

Audit requirements are defined

Secret-handling boundaries are defined

Database migration is idempotent

Database integrity is tested

Documentation exists

Existing foundation functionality remains intact

Changes are committed to Git

