import type { PoolClient } from "pg";

import { db } from "../../../infrastructure/database/pool.js";
import type { Asset, Project, ServiceRequest } from "../application/asset-management-service.js";

export type AssetRow = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  category: Asset["category"];
  status: Asset["status"];
  cost: number | string;
  location: string | null;
  description: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type ProjectRow = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  status: Project["status"];
  manager_user_id: string | null;
  start_date: Date | string | null;
  end_date: Date | string | null;
  budget: number | string;
  description: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type ServiceRow = {
  id: string;
  company_id: string;
  project_id: string | null;
  asset_id: string | null;
  code: string;
  name: string;
  status: ServiceRequest["status"];
  priority: ServiceRequest["priority"];
  description: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export const listCompanyAssets = async (companyId: string): Promise<Asset[]> => {
  const result = await db.query<AssetRow>(
    `
      SELECT id, company_id, code, name, category, status, cost, location, description, created_at, updated_at
      FROM asset_management.assets
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
    category: row.category,
    status: row.status,
    cost: Number(row.cost),
    location: row.location,
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
};

export const getAssetById = async (client: PoolClient, companyId: string, assetId: string): Promise<Asset | null> => {
  const result = await client.query<AssetRow>(
    `
      SELECT id, company_id, code, name, category, status, cost, location, description, created_at, updated_at
      FROM asset_management.assets
      WHERE company_id = $1 AND id = $2
      LIMIT 1
    `,
    [companyId, assetId],
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
    category: row.category,
    status: row.status,
    cost: Number(row.cost),
    location: row.location,
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const getAssetByCode = async (client: PoolClient, companyId: string, code: string): Promise<Asset | null> => {
  const result = await client.query<AssetRow>(
    `
      SELECT id, company_id, code, name, category, status, cost, location, description, created_at, updated_at
      FROM asset_management.assets
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
    category: row.category,
    status: row.status,
    cost: Number(row.cost),
    location: row.location,
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const insertAsset = async (
  client: PoolClient,
  companyId: string,
  asset: { code: string; name: string; category: Asset["category"]; status: Asset["status"]; cost: number; location: string | null; description: string | null },
): Promise<Asset> => {
  const result = await client.query<AssetRow>(
    `
      INSERT INTO asset_management.assets (company_id, code, name, category, status, cost, location, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, company_id, code, name, category, status, cost, location, description, created_at, updated_at
    `,
    [companyId, asset.code, asset.name, asset.category, asset.status, asset.cost, asset.location, asset.description],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    category: row.category,
    status: row.status,
    cost: Number(row.cost),
    location: row.location,
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const listCompanyProjects = async (companyId: string): Promise<Project[]> => {
  const result = await db.query<ProjectRow>(
    `
      SELECT id, company_id, code, name, status, manager_user_id, start_date, end_date, budget, description, created_at, updated_at
      FROM asset_management.projects
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
    status: row.status,
    managerUserId: row.manager_user_id,
    startDate: row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : null,
    endDate: row.end_date ? new Date(row.end_date).toISOString().slice(0, 10) : null,
    budget: Number(row.budget),
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
};

export const getProjectByCode = async (client: PoolClient, companyId: string, code: string): Promise<Project | null> => {
  const result = await client.query<ProjectRow>(
    `
      SELECT id, company_id, code, name, status, manager_user_id, start_date, end_date, budget, description, created_at, updated_at
      FROM asset_management.projects
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
    status: row.status,
    managerUserId: row.manager_user_id,
    startDate: row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : null,
    endDate: row.end_date ? new Date(row.end_date).toISOString().slice(0, 10) : null,
    budget: Number(row.budget),
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const getProjectById = async (client: PoolClient, companyId: string, projectId: string): Promise<Project | null> => {
  const result = await client.query<ProjectRow>(
    `
      SELECT id, company_id, code, name, status, manager_user_id, start_date, end_date, budget, description, created_at, updated_at
      FROM asset_management.projects
      WHERE company_id = $1 AND id = $2
      LIMIT 1
    `,
    [companyId, projectId],
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
    status: row.status,
    managerUserId: row.manager_user_id,
    startDate: row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : null,
    endDate: row.end_date ? new Date(row.end_date).toISOString().slice(0, 10) : null,
    budget: Number(row.budget),
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const insertProject = async (
  client: PoolClient,
  companyId: string,
  project: { code: string; name: string; status: Project["status"]; managerUserId: string | null; startDate: string | null; endDate: string | null; budget: number; description: string | null },
): Promise<Project> => {
  const result = await client.query<ProjectRow>(
    `
      INSERT INTO asset_management.projects (company_id, code, name, status, manager_user_id, start_date, end_date, budget, description)
      VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $9)
      RETURNING id, company_id, code, name, status, manager_user_id, start_date, end_date, budget, description, created_at, updated_at
    `,
    [companyId, project.code, project.name, project.status, project.managerUserId, project.startDate, project.endDate, project.budget, project.description],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    status: row.status,
    managerUserId: row.manager_user_id,
    startDate: row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : null,
    endDate: row.end_date ? new Date(row.end_date).toISOString().slice(0, 10) : null,
    budget: Number(row.budget),
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const listCompanyServices = async (companyId: string): Promise<ServiceRequest[]> => {
  const result = await db.query<ServiceRow>(
    `
      SELECT id, company_id, project_id, asset_id, code, name, status, priority, description, created_at, updated_at
      FROM asset_management.services
      WHERE company_id = $1
      ORDER BY code
    `,
    [companyId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    projectId: row.project_id,
    assetId: row.asset_id,
    code: row.code,
    name: row.name,
    status: row.status,
    priority: row.priority,
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
};

export const getServiceByCode = async (client: PoolClient, companyId: string, code: string): Promise<ServiceRequest | null> => {
  const result = await client.query<ServiceRow>(
    `
      SELECT id, company_id, project_id, asset_id, code, name, status, priority, description, created_at, updated_at
      FROM asset_management.services
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
    projectId: row.project_id,
    assetId: row.asset_id,
    code: row.code,
    name: row.name,
    status: row.status,
    priority: row.priority,
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const insertService = async (
  client: PoolClient,
  companyId: string,
  service: { projectId: string | null; assetId: string | null; code: string; name: string; status: ServiceRequest["status"]; priority: ServiceRequest["priority"]; description: string | null },
): Promise<ServiceRequest> => {
  const result = await client.query<ServiceRow>(
    `
      INSERT INTO asset_management.services (company_id, project_id, asset_id, code, name, status, priority, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, company_id, project_id, asset_id, code, name, status, priority, description, created_at, updated_at
    `,
    [companyId, service.projectId, service.assetId, service.code, service.name, service.status, service.priority, service.description],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    companyId: row.company_id,
    projectId: row.project_id,
    assetId: row.asset_id,
    code: row.code,
    name: row.name,
    status: row.status,
    priority: row.priority,
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};
