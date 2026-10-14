import type { FastifyBaseLogger } from "fastify";

import { withDatabaseTransaction } from "../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../../core-platform/audit/application/record-audit-event.js";
import {
  getDepartmentByCode,
  getEmployeeByNumber,
  getDepartmentById,
  insertDepartment,
  insertEmployee,
  listCompanyDepartments,
  listCompanyEmployees,
} from "../infrastructure/hr-repository.js";

export class HrValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HrValidationError";
  }
}

export class HrNotFoundError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "HrNotFoundError";
    this.code = code;
  }
}

export class HrConflictError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "HrConflictError";
    this.code = code;
  }
}

export type Department = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  managerUserId: string | null;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
};

export type Employee = {
  id: string;
  companyId: string;
  departmentId: string;
  departmentCode: string | null;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  managerUserId: string | null;
  status: "ACTIVE" | "INACTIVE" | "TERMINATED";
  hireDate: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
  createdAt: string;
  updatedAt: string;
};

type AuditContext = {
  actorUserId: string;
  organizationId: string;
  logger?: Pick<FastifyBaseLogger, "error">;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeUuid = (value: unknown, fieldName: string): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HrValidationError(`${fieldName} must be a valid UUID.`);
  }
  return value;
};

const normalizeCode = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new HrValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new HrValidationError(`${fieldName} is required.`);
  }
  if (normalized.length > 30) {
    throw new HrValidationError(`${fieldName} must not exceed 30 characters.`);
  }
  return normalized;
};

const normalizeName = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new HrValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new HrValidationError(`${fieldName} is required.`);
  }
  if (normalized.length > 100) {
    throw new HrValidationError(`${fieldName} must not exceed 100 characters.`);
  }
  return normalized;
};

const normalizeOptionalText = (value: unknown, fieldName: string, max: number): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new HrValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > max) {
    throw new HrValidationError(`${fieldName} must not exceed ${max} characters.`);
  }
  return normalized;
};

export const validateCreateDepartmentInput = (input: unknown): {
  code: string;
  name: string;
  managerUserId: string | null;
  description: string | null;
} => {
  if (!isRecord(input)) {
    throw new HrValidationError("Department input must be a JSON object.");
  }

  const allowedFields = new Set(["code", "name", "managerUserId", "description"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new HrValidationError("The request contains an unsupported field.");
  }

  return {
    code: normalizeCode(input.code, "Department code"),
    name: normalizeName(input.name, "Department name"),
    managerUserId: normalizeUuid(input.managerUserId, "Manager user ID"),
    description: normalizeOptionalText(input.description, "Description", 500),
  };
};

export const validateCreateEmployeeInput = (input: unknown): {
  departmentId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  managerUserId: string | null;
  status: Employee["status"];
  hireDate: string | null;
  employmentType: Employee["employmentType"];
} => {
  if (!isRecord(input)) {
    throw new HrValidationError("Employee input must be a JSON object.");
  }

  const allowedFields = new Set(["departmentId", "employeeNumber", "firstName", "lastName", "email", "managerUserId", "status", "hireDate", "employmentType"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new HrValidationError("The request contains an unsupported field.");
  }

  const status = input.status;
  if (status !== "ACTIVE" && status !== "INACTIVE" && status !== "TERMINATED") {
    throw new HrValidationError("Status must be ACTIVE, INACTIVE, or TERMINATED.");
  }

  const employmentType = input.employmentType ?? "FULL_TIME";
  if (employmentType !== "FULL_TIME" && employmentType !== "PART_TIME" && employmentType !== "CONTRACT" && employmentType !== "INTERN") {
    throw new HrValidationError("Employment type must be FULL_TIME, PART_TIME, CONTRACT, or INTERN.");
  }

  return {
    departmentId: normalizeUuid(input.departmentId, "Department ID") as string,
    employeeNumber: normalizeCode(input.employeeNumber, "Employee number"),
    firstName: normalizeName(input.firstName, "First name"),
    lastName: normalizeName(input.lastName, "Last name"),
    email: normalizeOptionalText(input.email, "Email", 320),
    managerUserId: normalizeUuid(input.managerUserId, "Manager user ID"),
    status,
    hireDate: input.hireDate ? normalizeOptionalText(input.hireDate, "Hire date", 20) : null,
    employmentType,
  };
};

export const listDepartments = async (companyId: string): Promise<Department[]> => listCompanyDepartments(companyId);

export const createDepartment = async (
  companyId: string,
  input: unknown,
  context: AuditContext,
): Promise<Department> => {
  const validated = validateCreateDepartmentInput(input);

  return withDatabaseTransaction(async (client) => {
    const existing = await getDepartmentByCode(client, companyId, validated.code);
    if (existing) {
      throw new HrConflictError("DEPARTMENT_CODE_EXISTS", "A department with this code already exists for the company.");
    }

    const department = await insertDepartment(client, companyId, validated);
    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "DEPARTMENT_CREATED",
        entityType: "HR_DEPARTMENT",
        entityId: department.id,
        status: "SUCCESS",
        sourceModule: "hr",
        afterData: { code: validated.code, name: validated.name },
        metadata: { operation: "hr.department.create" },
      },
      client,
    );

    return department;
  }, context.logger);
};

export const listEmployees = async (companyId: string): Promise<Employee[]> => listCompanyEmployees(companyId);

export const createEmployee = async (
  companyId: string,
  input: unknown,
  context: AuditContext,
): Promise<Employee> => {
  const validated = validateCreateEmployeeInput(input);

  return withDatabaseTransaction(async (client) => {
    const department = await getDepartmentById(client, companyId, validated.departmentId);
    if (!department) {
      throw new HrNotFoundError("DEPARTMENT_NOT_FOUND", "Department not found in this company.");
    }

    const existingEmployee = await getEmployeeByNumber(client, companyId, validated.employeeNumber);
    if (existingEmployee) {
      throw new HrConflictError("EMPLOYEE_NUMBER_EXISTS", "An employee with this number already exists for the company.");
    }

    const employee = await insertEmployee(client, companyId, validated);
    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "EMPLOYEE_CREATED",
        entityType: "HR_EMPLOYEE",
        entityId: employee.id,
        status: "SUCCESS",
        sourceModule: "hr",
        afterData: { employeeNumber: validated.employeeNumber, departmentId: validated.departmentId, status: validated.status },
        metadata: { operation: "hr.employee.create" },
      },
      client,
    );

    return employee;
  }, context.logger);
};
