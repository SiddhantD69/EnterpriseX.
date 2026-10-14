import type { PoolClient } from "pg";

import { db } from "../../../infrastructure/database/pool.js";
import type { Lead, Opportunity } from "../application/crm-service.js";

export type LeadRow = {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company_name: string;
  status: Lead["status"];
  source: Lead["source"];
  created_at: Date | string;
  updated_at: Date | string;
};

export type OpportunityRow = {
  id: string;
  company_id: string;
  lead_id: string;
  lead_name: string;
  name: string;
  stage: Opportunity["stage"];
  amount: number;
  probability: number;
  close_date: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export const listCompanyLeads = async (companyId: string): Promise<Lead[]> => {
  const result = await db.query<LeadRow>(
    `
      SELECT id, company_id, first_name, last_name, email, phone, company_name, status, source, created_at, updated_at
      FROM crm.leads
      WHERE company_id = $1
      ORDER BY last_name, first_name
    `,
    [companyId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    companyName: row.company_name,
    status: row.status,
    source: row.source,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
};

export const getLeadById = async (client: PoolClient, companyId: string, leadId: string): Promise<Lead | null> => {
  const result = await client.query<LeadRow>(
    `
      SELECT id, company_id, first_name, last_name, email, phone, company_name, status, source, created_at, updated_at
      FROM crm.leads
      WHERE company_id = $1 AND id = $2
      LIMIT 1
    `,
    [companyId, leadId],
  );

  if (!result.rows[0]) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    companyId: row.company_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    companyName: row.company_name,
    status: row.status,
    source: row.source,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const getLeadByEmail = async (client: PoolClient, companyId: string, email: string): Promise<Lead | null> => {
  const result = await client.query<LeadRow>(
    `
      SELECT id, company_id, first_name, last_name, email, phone, company_name, status, source, created_at, updated_at
      FROM crm.leads
      WHERE company_id = $1 AND LOWER(email) = LOWER($2)
      LIMIT 1
    `,
    [companyId, email],
  );

  if (!result.rows[0]) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    companyId: row.company_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    companyName: row.company_name,
    status: row.status,
    source: row.source,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const insertLead = async (
  client: PoolClient,
  companyId: string,
  lead: { firstName: string; lastName: string; email: string | null; phone: string | null; companyName: string; status: Lead["status"]; source: Lead["source"] },
): Promise<Lead> => {
  const result = await client.query<LeadRow>(
    `
      INSERT INTO crm.leads (company_id, first_name, last_name, email, phone, company_name, status, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, company_id, first_name, last_name, email, phone, company_name, status, source, created_at, updated_at
    `,
    [companyId, lead.firstName, lead.lastName, lead.email, lead.phone, lead.companyName, lead.status, lead.source],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    companyId: row.company_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    companyName: row.company_name,
    status: row.status,
    source: row.source,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};

export const listCompanyOpportunities = async (companyId: string): Promise<Opportunity[]> => {
  const result = await db.query<OpportunityRow>(
    `
      SELECT o.id, o.company_id, o.lead_id, l.company_name || ' / ' || l.first_name || ' ' || l.last_name AS lead_name,
             o.name, o.stage, o.amount, o.probability, o.close_date, o.created_at, o.updated_at
      FROM crm.opportunities o
      JOIN crm.leads l ON l.company_id = o.company_id AND l.id = o.lead_id
      WHERE o.company_id = $1
      ORDER BY o.created_at DESC
    `,
    [companyId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    leadId: row.lead_id,
    leadName: row.lead_name,
    name: row.name,
    stage: row.stage,
    amount: Number(row.amount),
    probability: Number(row.probability),
    closeDate: row.close_date ? new Date(row.close_date).toISOString().slice(0, 10) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
};

export const insertOpportunity = async (
  client: PoolClient,
  companyId: string,
  opportunity: { leadId: string; name: string; stage: Opportunity["stage"]; amount: number; probability: number; closeDate: string | null },
): Promise<Opportunity> => {
  const result = await client.query<OpportunityRow>(
    `
      INSERT INTO crm.opportunities (company_id, lead_id, name, stage, amount, probability, close_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7::date)
      RETURNING id, company_id, lead_id, name, stage, amount, probability, close_date, created_at, updated_at
    `,
    [companyId, opportunity.leadId, opportunity.name, opportunity.stage, opportunity.amount, opportunity.probability, opportunity.closeDate],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    companyId: row.company_id,
    leadId: row.lead_id,
    leadName: "",
    name: row.name,
    stage: row.stage,
    amount: Number(row.amount),
    probability: Number(row.probability),
    closeDate: row.close_date ? new Date(row.close_date).toISOString().slice(0, 10) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
};
