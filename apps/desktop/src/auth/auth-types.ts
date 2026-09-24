import type {
  CompanyContextStatus,
  LoginResponse,
  SelectableCompany,
} from "../api/auth-api";

import type { PlatformContext } from "../api/context-api";

export type AuthenticatedUser =
  LoginResponse["user"];

export type SessionState = {
  token: string;
  expiresAt: string;
};

export type CompanyContextState = {
  status: CompanyContextStatus;
  organizationId: string | null;
  companyId: string | null;
};

export type AuthState =
  | {
      status: "LOGGED_OUT";
      user: null;
      session: null;
      companyContext: null;
      context: null;
      companies: [];
    }
  | {
      status: "AUTHENTICATING";
      user: null;
      session: null;
      companyContext: null;
      context: null;
      companies: [];
    }
  | {
      status: "COMPANY_SELECTION_REQUIRED";
      user: AuthenticatedUser;
      session: SessionState;
      companyContext: CompanyContextState;
      context: null;
      companies: SelectableCompany[];
    }
  | {
      status: "LOADING_CONTEXT";
      user: AuthenticatedUser;
      session: SessionState;
      companyContext: CompanyContextState;
      context: null;
      companies: [];
    }
  | {
      status: "AUTHENTICATED";
      user: AuthenticatedUser;
      session: SessionState;
      companyContext: CompanyContextState & {
        status: "SELECTED";
        organizationId: string;
        companyId: string;
      };
      context: PlatformContext;
      companies: [];
    }
  | {
      status: "ERROR";
      message: string;
      user: AuthenticatedUser | null;
      session: SessionState | null;
      companyContext: CompanyContextState | null;
      context: PlatformContext | null;
      companies: SelectableCompany[];
    };