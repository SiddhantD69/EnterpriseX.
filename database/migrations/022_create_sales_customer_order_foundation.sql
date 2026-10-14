CREATE SCHEMA IF NOT EXISTS sales;

CREATE TABLE IF NOT EXISTS sales.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    customer_type VARCHAR(20) NOT NULL,
    email VARCHAR(320),
    phone VARCHAR(50),
    description VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT customers_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT customers_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT customers_company_code_unique
        UNIQUE (company_id, code),
    CONSTRAINT customers_type_check
        CHECK (customer_type IN ('B2B', 'B2C', 'INDIVIDUAL', 'GOVERNMENT')),
    CONSTRAINT customers_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX IF NOT EXISTS customers_company_idx
    ON sales.customers(company_id, status, code);

CREATE TABLE IF NOT EXISTS sales.sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    created_by UUID NOT NULL,
    document_number VARCHAR(50) NOT NULL,
    description VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    total_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_orders_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT sales_orders_customer_fk
        FOREIGN KEY (company_id, customer_id)
        REFERENCES sales.customers(company_id, id),
    CONSTRAINT sales_orders_created_by_fk
        FOREIGN KEY (created_by) REFERENCES security.users(id),
    CONSTRAINT sales_orders_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT sales_orders_company_number_unique
        UNIQUE (company_id, document_number),
    CONSTRAINT sales_orders_status_check
        CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
    CONSTRAINT sales_orders_total_amount_check
        CHECK (total_amount >= 0)
);

CREATE INDEX IF NOT EXISTS sales_orders_company_status_idx
    ON sales.sales_orders(company_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS sales.sales_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    order_id UUID NOT NULL,
    line_number INTEGER NOT NULL,
    description VARCHAR(255) NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    unit_price NUMERIC(18, 4) NOT NULL,
    amount NUMERIC(18, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_order_lines_order_fk
        FOREIGN KEY (company_id, order_id)
        REFERENCES sales.sales_orders(company_id, id),
    CONSTRAINT sales_order_lines_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT sales_order_lines_number_unique
        UNIQUE (company_id, order_id, line_number),
    CONSTRAINT sales_order_lines_quantity_check
        CHECK (quantity > 0),
    CONSTRAINT sales_order_lines_unit_price_check
        CHECK (unit_price >= 0),
    CONSTRAINT sales_order_lines_amount_check
        CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS sales_order_lines_order_idx
    ON sales.sales_order_lines(company_id, order_id, line_number);

INSERT INTO security.permissions (code, name, description)
VALUES
    ('sales.read', 'Read Sales', 'Read company sales information.'),
    ('sales.customers.read', 'Read Customers', 'Read sales customer master data.'),
    ('sales.customers.create', 'Create Customers', 'Create sales customer master data.'),
    ('sales.orders.read', 'Read Sales Orders', 'Read company sales orders.'),
    ('sales.orders.create', 'Create Sales Orders', 'Create customer sales orders.')
ON CONFLICT (code) DO NOTHING;
