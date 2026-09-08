# EnterpriseX Core Platform Architecture

**Status:** Draft  
**Version:** 1.0  
**Owner:** EnterpriseX Chief Architect  
**Scope:** Foundation V1

---

## 1. Purpose

The Core Platform provides the foundational capabilities required by every EnterpriseX business module.

It establishes the canonical definitions for:

- Organizations
- Companies
- Users
- Roles
- Permissions
- Configuration
- Audit
- System identity and ownership

Business modules must consume these foundations rather than creating competing versions.

---

## 2. Architectural Principle

EnterpriseX follows:

> One system → One data model → Connected business processes → Real-time information.

The Core Platform is the foundation for achieving this principle.

Each foundational entity must have:

- One authoritative owner
- One canonical representation
- Clearly defined relationships
- Controlled access
- Versioned database changes
- Documented API contracts

---

## 3. Organization Model

EnterpriseX must support organizations that contain one or more companies.

Conceptually:

Organization
└── Companies
    ├── Company A
    ├── Company B
    └── Company C

### Organization

An organization represents the top-level business boundary.

Examples:

- Enterprise group
- Business group
- Corporate organization

The organization owns the overall EnterpriseX environment.

### Company

A company represents a legal or operational business entity within an organization.

Business modules such as Finance, Procurement, Sales, Inventory and HR may operate within a company context.

---

## 4. Multi-Company Design

Foundation V1 will support multiple companies within an organization.

Every company-owned business record must have an explicit company relationship where required by the business model.

Examples:

- Customers
- Suppliers
- Financial documents
- Sales orders
- Purchase orders
- Inventory transactions
- Warehouse transactions
- Manufacturing transactions

The exact company ownership rules belong to the respective domain modules.

The Core Platform owns the company identity, not the business transactions.

---

## 5. User Model

Users represent authenticated EnterpriseX identities.

A user may have access to one or more organizations and companies according to authorization rules.

Conceptually:

User
├── Organization access
├── Company access
└── Role assignments

The Core Platform owns the user identity record.

Business modules must not create independent user tables.

---

## 6. Roles

A role is a named collection of permissions.

Conceptually:

Role
└── Permissions

Examples:

- Administrator
- Finance Manager
- Warehouse Manager
- Sales Manager
- Procurement User

Roles provide a manageable abstraction for assigning authorization.

---

## 7. Permissions

Permissions represent the smallest meaningful authorization capabilities exposed by the platform.

A permission should identify:

- Resource
- Action
- Scope where required

Examples:

```text
finance.invoice.read
finance.invoice.create
finance.invoice.approve

warehouse.stock.read
warehouse.stock.transfer

sales.order.read
sales.order.create
sales.order.approve