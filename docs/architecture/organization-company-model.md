# EnterpriseX Organization & Company Model

**Status:** Draft
**Version:** 1.0
**Owner:** EnterpriseX Chief Architect
**Scope:** Foundation V1

---

## 1. Purpose

This document defines the canonical Organization and Company model used throughout EnterpriseX.

The purpose is to establish one authoritative representation of organizational structure so that Finance, Supply Chain, Sales, Warehouse, Manufacturing, HR, CRM, and other modules do not create competing company structures.

---

## 2. Core Hierarchy

EnterpriseX uses the following foundational hierarchy:

Organization
└── Companies

An Organization may contain one or more Companies.

Example:

Organization: Example Group
├── Example Manufacturing Ltd.
├── Example Trading Ltd.
└── Example Services Ltd.

---

## 3. Organization

An Organization represents the top-level business environment in EnterpriseX.

It is the parent boundary for companies and platform-level configuration.

### Responsibilities

The Organization owns:

- Organization identity
- Organization-level configuration
- Company membership
- Organization-level administrative context

### Conceptual attributes

The Organization will require:

- Internal identifier
- Organization name
- Organization code
- Status
- Creation timestamp
- Last-update timestamp

Additional attributes may be introduced after business requirements are established.

---

## 4. Organization Code

Every Organization should have a unique human-readable code.

Example:

ACME

The code is intended for identification and administration.

It is not the database primary key.

---

## 5. Company

A Company represents a legal or operational business entity belonging to an Organization.

A company may participate in multiple EnterpriseX business processes.

Examples:

- Purchasing
- Sales
- Inventory
- Finance
- Manufacturing
- HR

The Company entity itself does not own these business processes.

The respective business modules own their transactional data.

---

## 6. Organization → Company Relationship

The relationship is:

Organization 1 ──────── N Company

Rules:

- Every Company belongs to exactly one Organization.
- An Organization may contain zero or more Companies.
- A Company cannot belong to multiple Organizations simultaneously.
- Company ownership is represented through a foreign-key relationship.

---

## 7. Company Code

Every Company should have a unique code within its Organization.

Example:

Organization: ACME

Companies:

MFG
TRD
SRV

The uniqueness rule is:

organization_id + company_code

This allows different organizations to independently use the same company code.

---

## 8. Company Name

Company names should be human-readable and suitable for administrative and business interfaces.

The name is not used as the primary identifier.

Names may change without changing the internal company identifier.

---

## 9. Internal Identifier

Organization and Company records must use stable internal identifiers.

The internal identifier:

- Must be unique.
- Must remain stable.
- Must not encode business meaning.
- Must not be reused after deletion where historical references could exist.

Business codes remain separate from internal identifiers.

---

## 10. Lifecycle

Organizations and Companies require an explicit lifecycle state.

Foundation V1 should support at least:

ACTIVE
INACTIVE

### ACTIVE

The entity may be used for normal business operations subject to authorization.

### INACTIVE

The entity cannot normally be used for new operational transactions.

Historical records referencing an inactive entity must remain available.

Deactivation should therefore be preferred over destructive deletion once business data exists.

---

## 11. Deletion Policy

Organization and Company records should not be physically deleted when historical business records depend on them.

Instead:

ACTIVE
   ↓
INACTIVE

The exact deletion/retention policy will be finalized during database implementation.

---

## 12. Audit Fields

Organization and Company records should contain standard platform audit information.

At minimum:

- created_at
- updated_at

The identity of the user responsible for important changes should be captured through the platform audit framework.

---

## 13. Ownership

Core Platform owns:

Organization
Company

Business modules consume these entities.

For example:

Finance
   ↓
Company

Sales
   ↓
Company

Warehouse
   ↓
Company

Manufacturing
   ↓
Company

No business module may create its own authoritative Company table.

---

## 14. Company References

When a business entity belongs to a Company, the owning business module should reference the canonical Core Platform Company identifier.

Example:

Sales Order
    │
    └── company_id
            ↓
       core.companies

The Sales module owns the Sales Order.

Core Platform owns the Company.

---

## 15. Organization Context

Authenticated operations should eventually execute within an Organization context.

The backend must verify that:

User
  ↓
has access to
  ↓
Organization
  ↓
and requested Company

A client must not be allowed to select an arbitrary Company identifier without authorization validation.

---

## 16. Multi-Company Operations

EnterpriseX must support users who have access to multiple Companies.

Example:

User
├── Company A
└── Company B

The selected Company context may affect:

- Transactions
- Reporting
- Master data
- Authorization
- Configuration

The exact behavior is owned by the respective modules.

---

## 17. Cross-Module Rule

Business modules must not duplicate:

- Organization identity
- Company identity
- Organization codes
- Company codes

They should reference the canonical Core Platform records.

---

## 18. Future Organizational Structures

The Organization → Company model may later be extended with structures such as:

Organization
├── Company
│   ├── Business Unit
│   ├── Department
│   ├── Location
│   └── Cost Center

These should not be added to Foundation V1 until their ownership and business requirements are clearly defined.

---

## 19. Conceptual Data Model

┌─────────────────────┐
│     Organization    │
├─────────────────────┤
│ id                  │
│ code                │
│ name                │
│ status              │
│ created_at          │
│ updated_at          │
└──────────┬──────────┘
           │
           │ 1:N
           │
┌──────────▼──────────┐
│       Company       │
├─────────────────────┤
│ id                  │
│ organization_id     │
│ code                │
│ name                │
│ status              │
│ created_at           │
│ updated_at          │
└─────────────────────┘

---

## 20. Database Constraints

The eventual database implementation should enforce:

- Organization primary-key uniqueness
- Company primary-key uniqueness
- Company → Organization foreign key
- Company code uniqueness within Organization
- Required fields using NOT NULL
- Valid lifecycle state using an appropriate constraint
- Appropriate indexes for common access patterns

Exact SQL definitions will be finalized during database implementation.

---

## 21. API Boundary

The Core Platform API will eventually expose controlled operations for:

- Creating organizations
- Reading organizations
- Updating organizations
- Activating/deactivating organizations
- Creating companies
- Reading companies
- Updating companies
- Activating/deactivating companies

Business modules should consume Company information through approved application/API contracts.

---

## 22. Security

Organization and Company operations are administrative capabilities.

Authorization must be enforced server-side.

The UI may hide unavailable actions, but the backend remains the authoritative security boundary.

---

## 23. Reporting

EnterpriseX reporting may require Organization and Company dimensions.

Because these entities are centrally owned, reporting systems can use their canonical identifiers.

Reports must not create alternate company identity systems.

---

## 24. Integration

External systems may provide their own organization/company identifiers.

EnterpriseX should maintain mappings between external identifiers and canonical EnterpriseX identifiers where required.

External identifiers must not replace the EnterpriseX internal identifier.

---

## 25. Implementation Boundary

This document defines the architecture and conceptual model.

It does not yet define the final production database schema.

Before implementation, we must finalize:

- Exact data types
- ID strategy
- Constraints
- Indexes
- Naming conventions
- Audit strategy
- API contracts
- Authorization behavior
- Migration
- Testing requirements

---

## 26. Decision

Foundation V1 adopts:

Organization
    ↓
Company

as the canonical organizational hierarchy.

Core Platform owns these entities.

All EnterpriseX business modules must reference this model rather than creating competing organizational structures.

---

**End of Organization & Company Model V1**