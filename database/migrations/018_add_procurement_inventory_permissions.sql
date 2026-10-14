INSERT INTO security.permissions (code, name, description)
VALUES
    ('core.suppliers.read', 'Read Suppliers', 'Read company suppliers.'),
    ('core.suppliers.create', 'Create Suppliers', 'Create company suppliers.'),
    ('core.suppliers.update', 'Update Suppliers', 'Update company suppliers.'),
    ('core.materials.read', 'Read Materials', 'Read company materials.'),
    ('core.materials.create', 'Create Materials', 'Create company materials.'),
    ('core.materials.update', 'Update Materials', 'Update company materials.'),
    ('core.currencies.read', 'Read Currencies', 'Read supported currencies.'),
    ('core.currencies.create', 'Create Currencies', 'Create supported currency definitions.'),
    ('core.currencies.update', 'Update Currencies', 'Update supported currency definitions.'),
    ('core.units_of_measure.read', 'Read Units', 'Read units of measure.'),
    ('core.units_of_measure.create', 'Create Units', 'Create units of measure.'),
    ('core.units_of_measure.update', 'Update Units', 'Update units of measure.'),
    ('procurement.requisitions.read', 'Read Requisitions', 'Read company purchase requisitions.'),
    ('procurement.requisitions.create', 'Create Requisitions', 'Create company purchase requisitions.'),
    ('procurement.requisitions.update', 'Update Requisitions', 'Edit draft company purchase requisitions.'),
    ('procurement.requisitions.submit', 'Submit Requisitions', 'Submit company purchase requisitions.'),
    ('procurement.purchase_orders.read', 'Read Purchase Orders', 'Read company purchase orders.'),
    ('procurement.purchase_orders.create', 'Create Purchase Orders', 'Create purchase orders from eligible requisitions.'),
    ('inventory.goods_receipts.create', 'Create Goods Receipts', 'Receive goods against company purchase orders.'),
    ('inventory.stock.read', 'Read Inventory Stock', 'Read company inventory balances and movements.'),
    ('procurement.supplier_invoices.read', 'Read Supplier Invoices', 'Read company supplier invoices.'),
    ('procurement.supplier_invoices.create', 'Create Supplier Invoices', 'Record matched company supplier invoices.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO security.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM security.roles r
CROSS JOIN security.permissions p
WHERE r.code = 'ERP_ADMIN'
  AND p.code IN (
      'core.suppliers.read',
      'core.suppliers.create',
      'core.suppliers.update',
      'core.materials.read',
      'core.materials.create',
      'core.materials.update',
      'core.currencies.read',
      'core.currencies.create',
      'core.currencies.update',
      'core.units_of_measure.read',
      'core.units_of_measure.create',
      'core.units_of_measure.update',
      'procurement.requisitions.read',
      'procurement.requisitions.create',
      'procurement.requisitions.update',
      'procurement.requisitions.submit',
      'procurement.purchase_orders.read',
      'procurement.purchase_orders.create',
      'inventory.goods_receipts.create',
      'inventory.stock.read',
      'procurement.supplier_invoices.read',
      'procurement.supplier_invoices.create'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;