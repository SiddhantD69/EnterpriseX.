export type AuthenticatedUserContext = {
  userId: string;
  email: string;
  displayName: string;
};

export type AuthenticatedOrganizationContext = {
  id: string;
  code: string;
  name: string;
};

export type AuthenticatedCompanyContext = {
  id: string;
  code: string;
  name: string;
};

export type AuthenticatedPermissionContext = {
  code: string;
  name: string;
};

export type AuthenticatedRoleContext = {
  id: string;
  code: string;
  name: string;
};

export type AuthenticatedContext = {
  sessionId: string;
  user: AuthenticatedUserContext;
  organization: AuthenticatedOrganizationContext;
  company: AuthenticatedCompanyContext;
  roles: AuthenticatedRoleContext[];
  permissions: AuthenticatedPermissionContext[];
};