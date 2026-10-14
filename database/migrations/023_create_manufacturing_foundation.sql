CREATE SCHEMA IF NOT EXISTS manufacturing;

CREATE TABLE IF NOT EXISTS manufacturing.boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    product_material_id UUID NOT NULL,
    quantity_per_batch NUMERIC(18, 4) NOT NULL,
    description VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT boms_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT boms_product_material_fk
        FOREIGN KEY (company_id, product_material_id)
        REFERENCES core.materials(company_id, id),
    CONSTRAINT boms_created_by_fk
        FOREIGN KEY (created_by) REFERENCES security.users(id),
    CONSTRAINT boms_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT boms_company_product_unique
        UNIQUE (company_id, product_material_id),
    CONSTRAINT boms_quantity_check
        CHECK (quantity_per_batch > 0),
    CONSTRAINT boms_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE IF NOT EXISTS manufacturing.bom_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    bom_id UUID NOT NULL,
    material_id UUID NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT bom_lines_bom_fk
        FOREIGN KEY (company_id, bom_id)
        REFERENCES manufacturing.boms(company_id, id),
    CONSTRAINT bom_lines_material_fk
        FOREIGN KEY (company_id, material_id)
        REFERENCES core.materials(company_id, id),
    CONSTRAINT bom_lines_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT bom_lines_unique
        UNIQUE (company_id, bom_id, material_id),
    CONSTRAINT bom_lines_quantity_check
        CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS manufacturing.production_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    bom_id UUID NOT NULL,
    plant_id UUID NOT NULL,
    document_number VARCHAR(50) NOT NULL,
    status VARCHAR(25) NOT NULL DEFAULT 'DRAFT',
    planned_quantity NUMERIC(18, 4) NOT NULL,
    produced_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    description VARCHAR(500),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT production_orders_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT production_orders_bom_fk
        FOREIGN KEY (company_id, bom_id)
        REFERENCES manufacturing.boms(company_id, id),
    CONSTRAINT production_orders_plant_fk
        FOREIGN KEY (company_id, plant_id)
        REFERENCES core.plants(company_id, id),
    CONSTRAINT production_orders_created_by_fk
        FOREIGN KEY (created_by) REFERENCES security.users(id),
    CONSTRAINT production_orders_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT production_orders_company_number_unique
        UNIQUE (company_id, document_number),
    CONSTRAINT production_orders_status_check
        CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT production_orders_quantity_check
        CHECK (planned_quantity > 0 AND produced_quantity >= 0)
);

CREATE TABLE IF NOT EXISTS manufacturing.production_order_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    production_order_id UUID NOT NULL,
    material_id UUID NOT NULL,
    storage_location_id UUID NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT production_issues_order_fk
        FOREIGN KEY (company_id, production_order_id)
        REFERENCES manufacturing.production_orders(company_id, id),
    CONSTRAINT production_issues_material_fk
        FOREIGN KEY (company_id, material_id)
        REFERENCES core.materials(company_id, id),
    CONSTRAINT production_issues_location_fk
        FOREIGN KEY (company_id, storage_location_id)
        REFERENCES core.storage_locations(company_id, id),
    CONSTRAINT production_issues_created_by_fk
        FOREIGN KEY (created_by) REFERENCES security.users(id),
    CONSTRAINT production_issues_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT production_issues_quantity_check
        CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS manufacturing.production_order_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    production_order_id UUID NOT NULL,
    storage_location_id UUID NOT NULL,
    produced_quantity NUMERIC(18, 4) NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT production_confirmations_order_fk
        FOREIGN KEY (company_id, production_order_id)
        REFERENCES manufacturing.production_orders(company_id, id),
    CONSTRAINT production_confirmations_location_fk
        FOREIGN KEY (company_id, storage_location_id)
        REFERENCES core.storage_locations(company_id, id),
    CONSTRAINT production_confirmations_created_by_fk
        FOREIGN KEY (created_by) REFERENCES security.users(id),
    CONSTRAINT production_confirmations_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT production_confirmations_quantity_check
        CHECK (produced_quantity > 0)
);

CREATE INDEX IF NOT EXISTS production_orders_company_status_idx
    ON manufacturing.production_orders(company_id, status, created_at DESC);

INSERT INTO security.permissions (code, name, description)
VALUES
    ('manufacturing.read', 'Read Manufacturing', 'Read manufacturing information and production status.'),
    ('manufacturing.boms.read', 'Read Bills of Material', 'Read manufacturing bills of material.'),
    ('manufacturing.boms.create', 'Create Bills of Material', 'Create BOMs for products.'),
    ('manufacturing.orders.read', 'Read Production Orders', 'Read production orders.'),
    ('manufacturing.orders.create', 'Create Production Orders', 'Create production orders.'),
    ('manufacturing.orders.issue', 'Issue Production Materials', 'Issue components for production runs.'),
    ('manufacturing.orders.confirm', 'Confirm Production', 'Confirm finished goods production and receipt.')
ON CONFLICT (code) DO NOTHING;
