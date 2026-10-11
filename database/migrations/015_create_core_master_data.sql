
-- EnterpriseX
-- Migration: 015_create_core_master_data
-- Purpose:
--   Establish company -> plant -> warehouse -> storage location.
--   Migration tracking is handled by the API migration runner.

CREATE TABLE core.plants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address_line_1 VARCHAR(255),
    address_line_2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country_code VARCHAR(10),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT plants_company_fk
        FOREIGN KEY (company_id)
        REFERENCES core.companies(id),

    CONSTRAINT plants_company_id_id_unique
        UNIQUE (company_id, id),

    CONSTRAINT plants_company_code_unique
        UNIQUE (company_id, code),

    CONSTRAINT plants_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX plants_company_id_idx
    ON core.plants (company_id);


CREATE TABLE core.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    plant_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    warehouse_type VARCHAR(30) NOT NULL DEFAULT 'STANDARD',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT warehouses_plant_company_fk
        FOREIGN KEY (company_id, plant_id)
        REFERENCES core.plants(company_id, id),

    CONSTRAINT warehouses_company_id_id_unique
        UNIQUE (company_id, id),

    CONSTRAINT warehouses_company_code_unique
        UNIQUE (company_id, code),

    CONSTRAINT warehouses_type_check
        CHECK (
            warehouse_type IN (
                'STANDARD',
                'RAW_MATERIAL',
                'FINISHED_GOODS',
                'SPARE_PARTS',
                'TRANSIT',
                'QUARANTINE'
            )
        ),

    CONSTRAINT warehouses_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX warehouses_company_id_idx
    ON core.warehouses (company_id);

CREATE INDEX warehouses_plant_id_idx
    ON core.warehouses (plant_id);


CREATE TABLE core.storage_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    warehouse_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT storage_locations_warehouse_company_fk
        FOREIGN KEY (company_id, warehouse_id)
        REFERENCES core.warehouses(company_id, id),

    CONSTRAINT storage_locations_company_code_unique
        UNIQUE (company_id, warehouse_id, code),

    CONSTRAINT storage_locations_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX storage_locations_warehouse_id_idx
    ON core.storage_locations (warehouse_id);
