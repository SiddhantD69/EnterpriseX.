import { apiRequest } from "./client";

export type CompanyContextStatus =
  | "SELECTED"
  | "SELECTION_REQUIRED"
  | "NO_COMPANY_ACCESS";

export type LoginResponse = {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  session: {
    token: string;
    expiresAt: string;
  };
  companyContext: {
    status: CompanyContextStatus;
    organizationId: string | null;
    companyId: string | null;
  };
};

export type SelectableCompany = {
  organization: {
    id: string;
    code: string;
    name: string;
  };
  company: {
    id: string;
    code: string;
    name: string;
  };
};

export type CompaniesResponse = {
  companies: SelectableCompany[];
};

export type CompanyContextResponse = {
  companyContext: {
    status: "SELECTED";
    organizationId: string;
    companyId: string;
  };
  organization: {
    id: string;
    code: string;
    name: string;
  };
  company: {
    id: string;
    code: string;
    name: string;
  };
};

export const login = async (
  email: string,
  password: string,
): Promise<LoginResponse> => {
  return apiRequest<LoginResponse>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
      }),
    },
  );
};

export const logout = async (
  token: string,
): Promise<void> => {
  await apiRequest<{ status: "ok" }>(
    "/api/v1/auth/logout",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
};

export const getCompanies = async (
  token: string,
): Promise<CompaniesResponse> => {
  return apiRequest<CompaniesResponse>(
    "/api/v1/auth/companies",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
};

export const selectCompanyContext =
  async (
    token: string,
    companyId: string,
  ): Promise<CompanyContextResponse> => {
    return apiRequest<CompanyContextResponse>(
      "/api/v1/auth/company-context",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId,
        }),
      },
    );
  };