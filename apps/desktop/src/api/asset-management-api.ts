import { apiRequest } from "./client";

export type AssetRecord = {
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

export type ProjectRecord = {
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

export type ServiceRecord = {
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

const authorized = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
});

export const listAssets = async (token: string): Promise<AssetRecord[]> =>
  (await apiRequest<{ data: AssetRecord[] }>("/api/v1/assets", { headers: authorized(token) })).data;

export const createAsset = async (token: string, input: {
  code: string;
  name: string;
  category: AssetRecord["category"];
  status?: AssetRecord["status"];
  cost?: number;
  location?: string | null;
  description?: string | null;
}): Promise<AssetRecord> =>
  (await apiRequest<{ data: AssetRecord }>("/api/v1/assets", {
    method: "POST",
    headers: authorized(token),
    body: JSON.stringify(input),
  })).data;

export const listProjects = async (token: string): Promise<ProjectRecord[]> =>
  (await apiRequest<{ data: ProjectRecord[] }>("/api/v1/projects", { headers: authorized(token) })).data;

export const createProject = async (token: string, input: {
  code: string;
  name: string;
  status?: ProjectRecord["status"];
  managerUserId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number;
  description?: string | null;
}): Promise<ProjectRecord> =>
  (await apiRequest<{ data: ProjectRecord }>("/api/v1/projects", {
    method: "POST",
    headers: authorized(token),
    body: JSON.stringify(input),
  })).data;

export const listServices = async (token: string): Promise<ServiceRecord[]> =>
  (await apiRequest<{ data: ServiceRecord[] }>("/api/v1/services", { headers: authorized(token) })).data;

export const createService = async (token: string, input: {
  projectId?: string | null;
  assetId?: string | null;
  code: string;
  name: string;
  status?: ServiceRecord["status"];
  priority?: ServiceRecord["priority"];
  description?: string | null;
}): Promise<ServiceRecord> =>
  (await apiRequest<{ data: ServiceRecord }>("/api/v1/services", {
    method: "POST",
    headers: authorized(token),
    body: JSON.stringify(input),
  })).data;
