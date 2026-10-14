# Procurement and Inventory Initial Slice

This document describes the currently implemented persisted workflow. It is an initial purchasing/receipt slice, not full procurement, inventory, accounts payable or accounting.

## Dependencies

Migration 017 adds shared currencies/UOMs, company document sequences, suppliers/materials, requisitions, purchase orders, goods receipts, inventory balances/movements, and matched supplier invoices. Migration 018 adds endpoint permissions and grants them to `ERP_ADMIN`. Both migrations are recorded as applied in the verified development database.

Materials reference an active UOM. Requisition plants, materials and suppliers are company-owned. Purchase order lines preserve source requisition lines. Receipts point to order lines and company-owned storage locations. Composite company FKs provide database tenant integrity. Document numbers are allocated by a company/document-type row update inside the business transaction.

## Endpoints

All endpoints below require a valid bearer session and the listed permission; company scope comes from authenticated server context.

| Method | Path | Permission | Result |
| --- | --- | --- | --- |
| GET/POST | `/api/v1/core/suppliers` | `core.suppliers.read/create` | Company suppliers |
| PUT | `/api/v1/core/suppliers/:id/status` | `core.suppliers.update` | Activate/deactivate supplier |
| GET/POST | `/api/v1/core/materials` | `core.materials.read/create` | Company materials |
| PUT | `/api/v1/core/materials/:id/status` | `core.materials.update` | Activate/deactivate material |
| GET/POST | `/api/v1/core/currencies` | `core.currencies.read/create` | Shared currency references |
| PUT | `/api/v1/core/currencies/:code/status` | `core.currencies.update` | Activate/deactivate currency |
| GET/POST | `/api/v1/core/units-of-measure` | `core.units_of_measure.read/create` | Shared UOM references |
| PUT | `/api/v1/core/units-of-measure/:code/status` | `core.units_of_measure.update` | Activate/deactivate UOM |
| GET/POST | `/api/v1/procurement/requisitions` | `procurement.requisitions.read/create` | List/create draft requests |
| GET/PUT | `/api/v1/procurement/requisitions/:id` | `procurement.requisitions.read/update` | Read/edit a draft |
| POST | `/api/v1/procurement/requisitions/:id/submit` | `procurement.requisitions.submit` | Draft → submitted |
| GET | `/api/v1/procurement/purchase-orders` | `procurement.purchase_orders.read` | List company orders |
| POST | `/api/v1/procurement/requisitions/:id/purchase-order` | `procurement.purchase_orders.create` | Create order from submitted request |
| POST | `/api/v1/inventory/purchase-orders/:id/receipts` | `inventory.goods_receipts.create` | Record receipt into storage locations |
| GET | `/api/v1/inventory/stock-balances` | `inventory.stock.read` | On-hand quantities by location/material |
| GET | `/api/v1/inventory/stock-movements` | `inventory.stock.read` | Recent receipt movements, capped at 500 |
| GET | `/api/v1/procurement/supplier-invoices` | `procurement.supplier_invoices.read` | List matched invoices |
| POST | `/api/v1/procurement/purchase-orders/:id/supplier-invoices` | `procurement.supplier_invoices.create` | Match invoice lines against receipts and PO prices |

## Workflow Rules

- Requisition quantities and PO/invoice prices accept up to four decimal places. Requisitions accept at most 100 lines.
- Draft requisitions can be edited and submitted; submitted requisitions cannot be edited. PO creation consumes the submitted requisition and copies every line, using a caller-provided unit price per source line.
- Separate approval is not implemented. Submission alone makes a requisition eligible for a user with PO-create permission.
- A goods receipt must target an active storage location in the same company and PO plant. Receipt quantities are checked while PO rows are locked and cannot exceed outstanding ordered quantities.
- Receipt header, lines, received quantities, stock balances, movement ledger and audit event commit in one transaction.
- Invoice quantities cannot exceed received/uninvoiced quantities, and each unit price must exactly match the PO unit price to four decimal places. Supplier invoice numbers are unique per company/supplier. A successful match is recorded as `MATCHED`.
- Audit insertion failure rolls back its associated business operation. Unexpected DB failures return generic 500s and are logged internally.

## Limitations

There is no tax calculation, currency conversion, invoice total/tax matching, AP liability, journal posting, payment, approval, requisition cancellation, PO cancellation API, stock reservation, adjustment, transfer or negative-stock configuration. Procurement only accepts a material's base unit; UOM conversion is not defined. These are not represented as completed capabilities in the UI or API.