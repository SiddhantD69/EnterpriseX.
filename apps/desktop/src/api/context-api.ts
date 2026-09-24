import { apiRequest } from "./client";

export type Permission = {
  code: string;
  name: string;
};

export type Role = {
  id: string;
  code: string;
  name: string;
};

export type PlatformContext = {
  user: {
    id: string;
    email: string;
    displayName: string;
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

  roles: Role[];

  permissions: Permission[];
};

export const getPlatformContext = async (
  token: string,
): Promise<PlatformContext> => {
  return apiRequest<PlatformContext>(
    "/api/v1/core/context",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
};