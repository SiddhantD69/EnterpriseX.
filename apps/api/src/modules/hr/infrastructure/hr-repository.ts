import type { PoolClient } from "pg";

import { db } from "../../../infrastructure/database/pool.js";
import type { Department, Employee } from "../application/hr-service.js";

export type DepartmentRow = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  manager_user_id: string | null;
  description: string | null;
  status: Department["status"];
  created_at: Date | string;
  updated_at: Date | string;
};

export type EmployeeRow = {
  id: string;
  company_id: string;
  department_id: string;
  department_code: string | null;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  manager_user_id: string | null;
  status: Employee["status"];
  hire_date: Date | string | null;
  employment_type: Employee["employmentType"];
  created_at: Date | string;
  updated_at: Date | string;
};

export const listCompanyDepartments = async (companyId: string): Promise<Department[]> => {
  const result = await db.query<DepartmentRow>(
    `
      SELECT id, company_id, code, name, manager_user_id, description, status, created_at, updated_at
      FROM hr.departments
      WHERE company_id = $1
      ORDER BY code
    `,
    [companyId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    managerUserId: row.manager_user_id,
    description: row.description,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
};

export const getDepartmentByCode = async (
  client: PoolClient,
  companyId: string,
  code: string,
): Promise<Department | null> => {
  const result = await client.query<DepartmentRow>(
    `
      SELECT id, company_id, code, name, manager_user_id, description, status, created_at, updated_at
      FROM hr.departments
      WHERE company_id = $1 AND code = $2
      LIMIT 1
    `,
    [companyId, code],
  );

  if (!result.rows[0]) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    managerUserId: row.manager_user_id,
    description: row.description,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const getDepartmentById = async (
  client: PoolClient,
  companyId: string,
  departmentId: string,
): Promise<Department | null> => {
  const result = await client.query<DepartmentRow>(
    `
      SELECT id, company_id, code, name, manager_user_id, description, status, created_at, updated_at
      FROM hr.departments
      WHERE company_id = $1 AND id = $2
      LIMIT 1
    `,
    [companyId, departmentId],
  );

  if (!result.rows[0]) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    managerUserId: row.manager_user_id,
    description: row.description,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const insertDepartment = async (
  client: PoolClient,
  companyId: string,
  department: { code: string; name: string; managerUserId: string | null; description: string | null },
): Promise<Department> => {
  const result = await client.query<DepartmentRow>(
    `
      INSERT INTO hr.departments (company_id, code, name, manager_user_id, description, status)
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
      RETURNING id, company_id, code, name, manager_user_id, description, status, created_at, updated_at
    `,
    [companyId, department.code, department.name, department.managerUserId, department.description],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    managerUserId: row.manager_user_id,
    description: row.description,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const listCompanyEmployees = async (companyId: string): Promise<Employee[]> => {
  const result = await db.query<EmployeeRow>(
    `
      SELECT e.id, e.company_id, e.department_id, d.code AS department_code,
             e.employee_number, e.first_name, e.last_name, e.email,
             e.manager_user_id, e.status, e.hire_date, e.employment_type,
             e.created_at, e.updated_at
      FROM hr.employees e
      LEFT JOIN hr.departments d ON d.company_id = e.company_id AND d.id = e.department_id
      WHERE e.company_id = $1
      ORDER BY e.last_name, e.first_name, e.employee_number
    `,
    [companyId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    departmentId: row.department_id,
    departmentCode: row.department_code,
    employeeNumber: row.employee_number,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    managerUserId: row.manager_user_id,
    status: row.status,
    hireDate: row.hire_date ? new Date(row.hire_date).toISOString() : new Date().toISOString(),
    employmentType: row.employment_type,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
};

export const getEmployeeByNumber = async (
  client: PoolClient,
  companyId: string,
  employeeNumber: string,
): Promise<Employee | null> => {
  const result = await client.query<EmployeeRow>(
    `
      SELECT e.id, e.company_id, e.department_id, d.code AS department_code,
             e.employee_number, e.first_name, e.last_name, e.email,
             e.manager_user_id, e.status, e.hire_date, e.employment_type,
             e.created_at, e.updated_at
      FROM hr.employees e
      LEFT JOIN hr.departments d ON d.company_id = e.company_id AND d.id = e.department_id
      WHERE e.company_id = $1 AND e.employee_number = $2
      LIMIT 1
    `,
    [companyId, employeeNumber],
  );

  if (!result.rows[0]) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    companyId: row.company_id,
    departmentId: row.department_id,
    departmentCode: row.department_code,
    employeeNumber: row.employee_number,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    managerUserId: row.manager_user_id,
    status: row.status,
    hireDate: row.hire_date ? new Date(row.hire_date).toISOString() : new Date().toISOString(),
    employmentType: row.employment_type,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const insertEmployee = async (
  client: PoolClient,
  companyId: string,
  employee: {
    departmentId: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    email: string | null;
    managerUserId: string | null;
    status: Employee["status"];
    hireDate: string | null;
    employmentType: Employee["employmentType"];
  },
): Promise<Employee> => {
  const result = await client.query<EmployeeRow>(
    `
      INSERT INTO hr.employees (
        company_id,
        department_id,
        employee_number,
        first_name,
        last_name,
        email,
        manager_user_id,
        status,
        hire_date,
        employment_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::date, CURRENT_DATE), $10)
      RETURNING id, company_id, department_id, employee_number, first_name, last_name,
                email, manager_user_id, status, hire_date, employment_type,
                created_at, updated_at
    `,
    [companyId, employee.departmentId, employee.employeeNumber, employee.firstName, employee.lastName, employee.email, employee.managerUserId, employee.status, employee.hireDate, employee.employmentType],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    companyId: row.company_id,
    departmentId: row.department_id,
    departmentCode: null,
    employeeNumber: row.employee_number,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    managerUserId: row.manager_user_id,
    status: row.status,
    hireDate: row.hire_date ? new Date(row.hire_date).toISOString() : new Date().toISOString(),
    employmentType: row.employment_type,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};
