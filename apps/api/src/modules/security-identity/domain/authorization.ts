import type {
  AuthenticatedContext,
} from "./authenticated-context.js";

export const hasPermission = (
  context: AuthenticatedContext,
  permissionCode: string,
): boolean => {
  if (!permissionCode.trim()) {
    return false;
  }

  return context.permissions.some(
    (permission) =>
      permission.code === permissionCode,
  );
};

export const hasAnyPermission = (
  context: AuthenticatedContext,
  permissionCodes: string[],
): boolean => {
  return permissionCodes.some(
    (permissionCode) =>
      hasPermission(
        context,
        permissionCode,
      ),
  );
};

export const hasAllPermissions = (
  context: AuthenticatedContext,
  permissionCodes: string[],
): boolean => {
  return permissionCodes.every(
    (permissionCode) =>
      hasPermission(
        context,
        permissionCode,
      ),
  );
};