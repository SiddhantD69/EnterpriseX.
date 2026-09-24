import {
  findAuditEvents,
} from "../infrastructure/audit-repository.js";

export type ListAuditEventsInput = {
  organizationId: string;
  companyId: string;
  limit: number;
  offset: number;
  action?: string;
  entityType?: string;
  status?: string;
};

export const listAuditEvents = async (
  input: ListAuditEventsInput,
) => {
  return findAuditEvents(input);
};