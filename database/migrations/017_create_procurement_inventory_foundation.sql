CREATE SCHEMA IF NOT EXISTS procurement;
CREATE SCHEMA IF NOT EXISTS inventory;

ALTER TABLE core.storage_locations
    ADD CONSTRAINT storage_locations_company_id_id_unique
    UNIQUE (company_id, id);

CREATE TABLE core.currencies (
    code CHAR(3) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    decimal_places SMALLINT NOT NULL DEFAULT 2,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT currencies_decimal_places_check
        CHECK (decimal_places BETWEEN 0 AND 4),
    CONSTRAINT currencies_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE core.units_of_measure (
    code VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    decimal_places SMALLINT NOT NULL DEFAULT 4,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT units_decimal_places_check
        CHECK (decimal_places BETWEEN 0 AND 6),
    CONSTRAINT units_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE core.document_number_sequences (
    company_id UUID NOT NULL,
    document_type VARCHAR(40) NOT NULL,
    prefix VARCHAR(20) NOT NULL,
    next_value BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_number_sequences_pk
        PRIMARY KEY (company_id, document_type),
    CONSTRAINT document_number_sequences_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT document_number_sequences_next_check
        CHECK (next_value > 0)
);

CREATE TABLE core.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(320),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT suppliers_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT suppliers_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT suppliers_company_code_unique
        UNIQUE (company_id, code),
    CONSTRAINT suppliers_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX suppliers_company_idx ON core.suppliers(company_id);

CREATE TABLE core.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    base_unit_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT materials_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT materials_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT materials_company_code_unique
        UNIQUE (company_id, code),
    CONSTRAINT materials_base_unit_fk
        FOREIGN KEY (base_unit_code) REFERENCES core.units_of_measure(code),
    CONSTRAINT materials_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX materials_company_idx ON core.materials(company_id);

CREATE TABLE procurement.requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    plant_id UUID NOT NULL,
    document_number VARCHAR(50) NOT NULL,
    requester_user_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    description VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT requisitions_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT requisitions_plant_company_fk
        FOREIGN KEY (company_id, plant_id)
        REFERENCES core.plants(company_id, id),
    CONSTRAINT requisitions_requester_fk
        FOREIGN KEY (requester_user_id) REFERENCES security.users(id),
    CONSTRAINT requisitions_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT requisitions_company_number_unique
        UNIQUE (company_id, document_number),
    CONSTRAINT requisitions_status_check
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'PARTIALLY_ORDERED', 'ORDERED', 'CANCELLED'))
);

CREATE INDEX requisitions_company_status_idx
    ON procurement.requisitions(company_id, status, created_at DESC);

CREATE TABLE procurement.requisition_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    requisition_id UUID NOT NULL,
    line_number INTEGER NOT NULL,
    material_id UUID NOT NULL,
    unit_code VARCHAR(20) NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT requisition_lines_requisition_fk
        FOREIGN KEY (company_id, requisition_id)
        REFERENCES procurement.requisitions(company_id, id),
    CONSTRAINT requisition_lines_material_fk
        FOREIGN KEY (company_id, material_id)
        REFERENCES core.materials(company_id, id),
    CONSTRAINT requisition_lines_unit_fk
        FOREIGN KEY (unit_code) REFERENCES core.units_of_measure(code),
    CONSTRAINT requisition_lines_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT requisition_lines_number_unique
        UNIQUE (company_id, requisition_id, line_number),
    CONSTRAINT requisition_lines_quantity_check
        CHECK (quantity > 0)
);

CREATE TABLE procurement.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    plant_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    document_number VARCHAR(50) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT purchase_orders_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT purchase_orders_plant_fk
        FOREIGN KEY (company_id, plant_id)
        REFERENCES core.plants(company_id, id),
    CONSTRAINT purchase_orders_supplier_fk
        FOREIGN KEY (company_id, supplier_id)
        REFERENCES core.suppliers(company_id, id),
    CONSTRAINT purchase_orders_currency_fk
        FOREIGN KEY (currency_code) REFERENCES core.currencies(code),
    CONSTRAINT purchase_orders_created_by_fk
        FOREIGN KEY (created_by) REFERENCES security.users(id),
    CONSTRAINT purchase_orders_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT purchase_orders_company_number_unique
        UNIQUE (company_id, document_number),
    CONSTRAINT purchase_orders_status_check
        CHECK (status IN ('OPEN', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'))
);

CREATE INDEX purchase_orders_company_status_idx
    ON procurement.purchase_orders(company_id, status, created_at DESC);

CREATE TABLE procurement.purchase_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    purchase_order_id UUID NOT NULL,
    source_requisition_line_id UUID,
    line_number INTEGER NOT NULL,
    material_id UUID NOT NULL,
    unit_code VARCHAR(20) NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    received_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    invoiced_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    unit_price NUMERIC(18, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT purchase_order_lines_order_fk
        FOREIGN KEY (company_id, purchase_order_id)
        REFERENCES procurement.purchase_orders(company_id, id),
    CONSTRAINT purchase_order_lines_requisition_line_fk
        FOREIGN KEY (company_id, source_requisition_line_id)
        REFERENCES procurement.requisition_lines(company_id, id),
    CONSTRAINT purchase_order_lines_material_fk
        FOREIGN KEY (company_id, material_id)
        REFERENCES core.materials(company_id, id),
    CONSTRAINT purchase_order_lines_unit_fk
        FOREIGN KEY (unit_code) REFERENCES core.units_of_measure(code),
    CONSTRAINT purchase_order_lines_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT purchase_order_lines_number_unique
        UNIQUE (company_id, purchase_order_id, line_number),
    CONSTRAINT purchase_order_lines_quantity_check
        CHECK (quantity > 0 AND received_quantity >= 0 AND received_quantity <= quantity),
    CONSTRAINT purchase_order_lines_invoice_quantity_check
        CHECK (invoiced_quantity >= 0 AND invoiced_quantity <= received_quantity),
    CONSTRAINT purchase_order_lines_unit_price_check
        CHECK (unit_price >= 0)
);

CREATE TABLE inventory.stock_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    storage_location_id UUID NOT NULL,
    material_id UUID NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT stock_balances_location_fk
        FOREIGN KEY (company_id, storage_location_id)
        REFERENCES core.storage_locations(company_id, id),
    CONSTRAINT stock_balances_material_fk
        FOREIGN KEY (company_id, material_id)
        REFERENCES core.materials(company_id, id),
    CONSTRAINT stock_balances_location_material_unique
        UNIQUE (company_id, storage_location_id, material_id),
    CONSTRAINT stock_balances_quantity_check
        CHECK (quantity >= 0)
);

CREATE TABLE inventory.goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    purchase_order_id UUID NOT NULL,
    document_number VARCHAR(50) NOT NULL,
    received_by UUID NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT goods_receipts_order_fk
        FOREIGN KEY (company_id, purchase_order_id)
        REFERENCES procurement.purchase_orders(company_id, id),
    CONSTRAINT goods_receipts_received_by_fk
        FOREIGN KEY (received_by) REFERENCES security.users(id),
    CONSTRAINT goods_receipts_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT goods_receipts_company_number_unique
        UNIQUE (company_id, document_number)
);

CREATE TABLE inventory.goods_receipt_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    goods_receipt_id UUID NOT NULL,
    purchase_order_line_id UUID NOT NULL,
    storage_location_id UUID NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT goods_receipt_lines_receipt_fk
        FOREIGN KEY (company_id, goods_receipt_id)
        REFERENCES inventory.goods_receipts(company_id, id),
    CONSTRAINT goods_receipt_lines_order_line_fk
        FOREIGN KEY (company_id, purchase_order_line_id)
        REFERENCES procurement.purchase_order_lines(company_id, id),
    CONSTRAINT goods_receipt_lines_location_fk
        FOREIGN KEY (company_id, storage_location_id)
        REFERENCES core.storage_locations(company_id, id),
    CONSTRAINT goods_receipt_lines_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT goods_receipt_lines_quantity_check
        CHECK (quantity > 0)
);

CREATE TABLE inventory.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    goods_receipt_line_id UUID NOT NULL,
    storage_location_id UUID NOT NULL,
    material_id UUID NOT NULL,
    quantity_delta NUMERIC(18, 4) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT stock_movements_receipt_line_fk
        FOREIGN KEY (company_id, goods_receipt_line_id)
        REFERENCES inventory.goods_receipt_lines(company_id, id),
    CONSTRAINT stock_movements_location_fk
        FOREIGN KEY (company_id, storage_location_id)
        REFERENCES core.storage_locations(company_id, id),
    CONSTRAINT stock_movements_material_fk
        FOREIGN KEY (company_id, material_id)
        REFERENCES core.materials(company_id, id),
    CONSTRAINT stock_movements_quantity_check
        CHECK (quantity_delta <> 0),
    CONSTRAINT stock_movements_receipt_line_unique
        UNIQUE (company_id, goods_receipt_line_id)
);

CREATE TABLE procurement.supplier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    purchase_order_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    supplier_invoice_number VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'MATCHED',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT supplier_invoices_order_fk
        FOREIGN KEY (company_id, purchase_order_id)
        REFERENCES procurement.purchase_orders(company_id, id),
    CONSTRAINT supplier_invoices_supplier_fk
        FOREIGN KEY (company_id, supplier_id)
        REFERENCES core.suppliers(company_id, id),
    CONSTRAINT supplier_invoices_created_by_fk
        FOREIGN KEY (created_by) REFERENCES security.users(id),
    CONSTRAINT supplier_invoices_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT supplier_invoices_supplier_number_unique
        UNIQUE (company_id, supplier_id, supplier_invoice_number),
    CONSTRAINT supplier_invoices_status_check
        CHECK (status IN ('MATCHED', 'CANCELLED'))
);

CREATE TABLE procurement.supplier_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    supplier_invoice_id UUID NOT NULL,
    purchase_order_line_id UUID NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    unit_price NUMERIC(18, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT supplier_invoice_lines_invoice_fk
        FOREIGN KEY (company_id, supplier_invoice_id)
        REFERENCES procurement.supplier_invoices(company_id, id),
    CONSTRAINT supplier_invoice_lines_order_line_fk
        FOREIGN KEY (company_id, purchase_order_line_id)
        REFERENCES procurement.purchase_order_lines(company_id, id),
    CONSTRAINT supplier_invoice_lines_quantity_check
        CHECK (quantity > 0),
    CONSTRAINT supplier_invoice_lines_price_check
        CHECK (unit_price >= 0)
);