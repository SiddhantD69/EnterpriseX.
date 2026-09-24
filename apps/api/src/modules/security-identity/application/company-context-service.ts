import {
  findSelectableCompaniesByUserId,
  findSelectableCompanyByUserId,
} from "../infrastructure/company-selection-repository.js";

import {
  updateSessionCompanyContext,
} from "../infrastructure/session-repository.js";

import {
  authenticateSessionToken,
} from "./session-authentication-service.js";

import {
  recordCompanyContextSelected,
} from "./security-audit-service.js";

export type CompanyContextServiceResult =
  | {
      status: "SELECTED";
      company: {
        organizationId: string;
        organizationCode: string;
        organizationName: string;
        companyId: string;
        companyCode: string;
        companyName: string;
      };
    }
  | {
      status: "AUTHENTICATION_REQUIRED";
    }
  | {
      status: "COMPANY_NOT_ALLOWED";
    }
  | {
      status: "SESSION_UPDATE_FAILED";
    };

export const getSelectableCompanies = async (
  token: string,
) => {
  const authenticated =
    await authenticateSessionToken(token);

  if (!authenticated) {
    return {
      status: "AUTHENTICATION_REQUIRED" as const,
      companies: [],
    };
  }

  const companies =
    await findSelectableCompaniesByUserId(
      authenticated.session.userId,
    );

  return {
    status: "OK" as const,
    companies,
  };
};

export const selectCompanyContext = async (
  token: string,
  companyId: string,
): Promise<CompanyContextServiceResult> => {
  const authenticated =
    await authenticateSessionToken(token);

  if (!authenticated) {
    return {
      status: "AUTHENTICATION_REQUIRED",
    };
  }

  const company =
    await findSelectableCompanyByUserId(
      authenticated.session.userId,
      companyId,
    );

  if (!company) {
    return {
      status: "COMPANY_NOT_ALLOWED",
    };
  }

  const updatedSession =
    await updateSessionCompanyContext(
      authenticated.session.id,
      company.companyId,
    );

  if (!updatedSession) {
    return {
      status: "SESSION_UPDATE_FAILED",
    };
  }

  try {
    await recordCompanyContextSelected({
      userId: authenticated.session.userId,
      sessionId: authenticated.session.id,
      organizationId: company.organizationId,
      companyId: company.companyId,
      previousCompanyId:
        authenticated.session.companyId,
    });
  } catch {
    /*
     * Company selection remains valid when
     * audit infrastructure is unavailable.
     */
  }

  return {
    status: "SELECTED",
    company,
  };
};
