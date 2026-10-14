CREATE SCHEMA IF NOT EXISTS hr;

CREATE TABLE IF NOT EXISTS hr.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    manager_user_id UUID,
    description VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT departments_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT departments_manager_user_fk
        FOREIGN KEY (manager_user_id) REFERENCES security.users(id),
    CONSTRAINT departments_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT departments_company_code_unique
        UNIQUE (company_id, code),
    CONSTRAINT departments_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE IF NOT EXISTS hr.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    department_id UUID NOT NULL,
    employee_number VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(320),
    manager_user_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    employment_type VARCHAR(30) NOT NULL DEFAULT 'FULL_TIME',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT employees_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT employees_department_fk
        FOREIGN KEY (company_id, department_id)
        REFERENCES hr.departments(company_id, id),
    CONSTRAINT employees_manager_user_fk
        FOREIGN KEY (manager_user_id) REFERENCES security.users(id),
    CONSTRAINT employees_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT employees_company_number_unique
        UNIQUE (company_id, employee_number),
    CONSTRAINT employees_company_email_unique
        UNIQUE (company_id, email),
    CONSTRAINT employees_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'TERMINATED')),
    CONSTRAINT employees_employment_type_check
        CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'))
);

INSERT INTO security.permissions (code, name, description)
VALUES
    ('hr.read', 'Read HR', 'Read HR information and employee data.'),
    ('hr.departments.read', 'Read Departments', 'Read company department structure.'),
    ('hr.departments.create', 'Create Departments', 'Create and maintain department records.'),
    ('hr.employees.read', 'Read Employees', 'Read employee master records.'),
    ('hr.employees.create', 'Create Employees', 'Create employee master records.')
ON CONFLICT (code) DO NOTHING;
