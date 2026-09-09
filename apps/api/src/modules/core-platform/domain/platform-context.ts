export type PlatformUserContext = {
  userId: string;
  email: string;
  displayName: string;
};

export type PlatformOrganizationContext = {
  id: string;
  code: string;
  name: string;
};

export type PlatformCompanyContext = {
  id: string;
  code: string;
  name: string;
};

export type PlatformPermissionContext = {
  code: string;
  name: string;
};

export type PlatformContext = {
  user: PlatformUserContext;
  organization: PlatformOrganizationContext;
  company: PlatformCompanyContext;
  permissions: PlatformPermissionContext[];
};