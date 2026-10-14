import type { FastifyBaseLogger } from "fastify";

import { withDatabaseTransaction } from "../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../../core-platform/audit/application/record-audit-event.js";
import {
  getAssetByCode,
  getAssetById,
  getProjectByCode,
  getProjectById,
  getServiceByCode,
  insertAsset,
  insertProject,
  insertService,
  listCompanyAssets,
  listCompanyProjects,
  listCompanyServices,
} from "../infrastructure/asset-management-repository.js";

export class AssetManagementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetManagementValidationError";
  }
}

export class AssetManagementNotFoundError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AssetManagementNotFoundError";
    this.code = code;
  }
}

export class AssetManagementConflictError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AssetManagementConflictError";
    this.code = code;
  }
}

export type Asset = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  category: "BUILDING" | "VEHICLE" | "MACHINE" | "IT" | "EQUIPMENT" | "FURNITURE";
  status: "ACTIVE" | "INACTIVE" | "RETIRED";
  cost: number;
  location: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  status: "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  managerUserId: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceRequest = {
  id: string;
  companyId: string;
  projectId: string | null;
  assetId: string | null;
  code: string;
  name: string;
  status: "OPEN" | "IN_PROGRESS" | "HOLD" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string | null;
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
    throw new AssetManagementValidationError(`${fieldName} must be a valid UUID.`);
  }
  return value;
};

const normalizeCode = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new AssetManagementValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new AssetManagementValidationError(`${fieldName} is required.`);
  }
  if (normalized.length > 50) {
    throw new AssetManagementValidationError(`${fieldName} must not exceed 50 characters.`);
  }
  return normalized;
};

const normalizeName = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new AssetManagementValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new AssetManagementValidationError(`${fieldName} is required.`);
  }
  if (normalized.length > 255) {
    throw new AssetManagementValidationError(`${fieldName} must not exceed 255 characters.`);
  }
  return normalized;
};

const normalizeOptionalText = (value: unknown, fieldName: string, max: number): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new AssetManagementValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > max) {
    throw new AssetManagementValidationError(`${fieldName} must not exceed ${max} characters.`);
  }
  return normalized;
};

const normalizeNonNegativeNumber = (value: unknown, fieldName: string): number => {
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new AssetManagementValidationError(`${fieldName} must be a non-negative number.`);
    }
    return parsed;
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  throw new AssetManagementValidationError(`${fieldName} must be a non-negative number.`);
};

export const validateCreateAssetInput = (input: unknown): {
  code: string;
  name: string;
  category: Asset["category"];
  status: Asset["status"];
  cost: number;
  location: string | null;
  description: string | null;
} => {
  if (!isRecord(input)) {
    throw new AssetManagementValidationError("Asset input must be a JSON object.");
  }

  const allowedFields = new Set(["code", "name", "category", "status", "cost", "location", "description"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new AssetManagementValidationError("The request contains an unsupported field.");
  }

  const category = input.category;
  if (category !== "BUILDING" && category !== "VEHICLE" && category !== "MACHINE" && category !== "IT" && category !== "EQUIPMENT" && category !== "FURNITURE") {
    throw new AssetManagementValidationError("Asset category must be BUILDING, VEHICLE, MACHINE, IT, EQUIPMENT, or FURNITURE.");
  }

  const status = input.status;
  if (status !== "ACTIVE" && status !== "INACTIVE" && status !== "RETIRED") {
    throw new AssetManagementValidationError("Asset status must be ACTIVE, INACTIVE, or RETIRED.");
  }

  return {
    code: normalizeCode(input.code, "Asset code"),
    name: normalizeName(input.name, "Asset name"),
    category,
    status,
    cost: normalizeNonNegativeNumber(input.cost, "Asset cost"),
    location: normalizeOptionalText(input.location, "Location", 255),
    description: normalizeOptionalText(input.description, "Description", 500),
  };
};

export const validateCreateProjectInput = (input: unknown): {
  code: string;
  name: string;
  status: Project["status"];
  managerUserId: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number;
  description: string | null;
} => {
  if (!isRecord(input)) {
    throw new AssetManagementValidationError("Project input must be a JSON object.");
  }

  const allowedFields = new Set(["code", "name", "status", "managerUserId", "startDate", "endDate", "budget", "description"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new AssetManagementValidationError("The request contains an unsupported field.");
  }

  const status = input.status;
  if (status !== "PLANNED" && status !== "ACTIVE" && status !== "ON_HOLD" && status !== "COMPLETED" && status !== "CANCELLED") {
    throw new AssetManagementValidationError("Project status must be PLANNED, ACTIVE, ON_HOLD, COMPLETED, or CANCELLED.");
  }

  return {
    code: normalizeCode(input.code, "Project code"),
    name: normalizeName(input.name, "Project name"),
    status,
    managerUserId: normalizeUuid(input.managerUserId, "Manager user ID"),
    startDate: normalizeOptionalText(input.startDate, "Start date", 30),
    endDate: normalizeOptionalText(input.endDate, "End date", 30),
    budget: normalizeNonNegativeNumber(input.budget, "Project budget"),
    description: normalizeOptionalText(input.description, "Description", 1000),
  };
};

export const validateCreateServiceInput = (input: unknown): {
  projectId: string | null;
  assetId: string | null;
  code: string;
  name: string;
  status: ServiceRequest["status"];
  priority: ServiceRequest["priority"];
  description: string | null;
} => {
  if (!isRecord(input)) {
    throw new AssetManagementValidationError("Service input must be a JSON object.");
  }

  const allowedFields = new Set(["projectId", "assetId", "code", "name", "status", "priority", "description"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new AssetManagementValidationError("The request contains an unsupported field.");
  }

  const status = input.status;
  if (status !== "OPEN" && status !== "IN_PROGRESS" && status !== "HOLD" && status !== "RESOLVED" && status !== "CLOSED") {
    throw new AssetManagementValidationError("Service status must be OPEN, IN_PROGRESS, HOLD, RESOLVED, or CLOSED.");
  }

  const priority = input.priority;
  if (priority !== "LOW" && priority !== "MEDIUM" && priority !== "HIGH" && priority !== "CRITICAL") {
    throw new AssetManagementValidationError("Service priority must be LOW, MEDIUM, HIGH, or CRITICAL.");
  }

  return {
    projectId: normalizeUuid(input.projectId, "Project ID"),
    assetId: normalizeUuid(input.assetId, "Asset ID"),
    code: normalizeCode(input.code, "Service code"),
    name: normalizeName(input.name, "Service name"),
    status,
    priority,
    description: normalizeOptionalText(input.description, "Description", 1000),
  };
};

export const listAssets = async (companyId: string): Promise<Asset[]> => listCompanyAssets(companyId);

export const createAsset = async (
  companyId: string,
  input: unknown,
  context: AuditContext,
): Promise<Asset> => {
  const validated = validateCreateAssetInput(input);

  return withDatabaseTransaction(async (client) => {
    const existing = await getAssetByCode(client, companyId, validated.code);
    if (existing) {
      throw new AssetManagementConflictError("ASSET_CODE_EXISTS", "An asset with this code already exists for the company.");
    }

    const asset = await insertAsset(client, companyId, validated);
    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "ASSET_CREATED",
        entityType: "ASSET",
        entityId: asset.id,
        status: "SUCCESS",
        sourceModule: "assets",
        afterData: { code: validated.code, name: validated.name, category: validated.category },
        metadata: { operation: "assets.create" },
      },
      client,
    );

    return asset;
  }, context.logger);
};

export const listProjects = async (companyId: string): Promise<Project[]> => listCompanyProjects(companyId);

export const createProject = async (
  companyId: string,
  input: unknown,
  context: AuditContext,
): Promise<Project> => {
  const validated = validateCreateProjectInput(input);

  return withDatabaseTransaction(async (client) => {
    const existing = await getProjectByCode(client, companyId, validated.code);
    if (existing) {
      throw new AssetManagementConflictError("PROJECT_CODE_EXISTS", "A project with this code already exists for the company.");
    }

    const project = await insertProject(client, companyId, validated);
    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "PROJECT_CREATED",
        entityType: "PROJECT",
        entityId: project.id,
        status: "SUCCESS",
        sourceModule: "projects",
        afterData: { code: validated.code, name: validated.name, status: validated.status },
        metadata: { operation: "projects.create" },
      },
      client,
    );

    return project;
  }, context.logger);
};

export const listServices = async (companyId: string): Promise<ServiceRequest[]> => listCompanyServices(companyId);

export const createServiceRequest = async (
  companyId: string,
  input: unknown,
  context: AuditContext,
): Promise<ServiceRequest> => {
  const validated = validateCreateServiceInput(input);

  return withDatabaseTransaction(async (client) => {
    if (!validated.projectId && !validated.assetId) {
      throw new AssetManagementValidationError("A service request must be linked to a project or asset.");
    }

    if (validated.projectId) {
      const project = await getProjectById(client, companyId, validated.projectId);
      if (!project) {
        throw new AssetManagementNotFoundError("PROJECT_NOT_FOUND", "Project not found in this company.");
      }
    }

    if (validated.assetId) {
      const asset = await getAssetById(client, companyId, validated.assetId);
      if (!asset) {
        throw new AssetManagementNotFoundError("ASSET_NOT_FOUND", "Asset not found in this company.");
      }
    }

    const existing = await getServiceByCode(client, companyId, validated.code);
    if (existing) {
      throw new AssetManagementConflictError("SERVICE_CODE_EXISTS", "A service request with this code already exists for the company.");
    }

    const service = await insertService(client, companyId, validated);
    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "SERVICE_CREATED",
        entityType: "SERVICE_REQUEST",
        entityId: service.id,
        status: "SUCCESS",
        sourceModule: "services",
        afterData: { code: validated.code, name: validated.name, priority: validated.priority },
        metadata: { operation: "services.create" },
      },
      client,
    );

    return service;
  }, context.logger);
};
