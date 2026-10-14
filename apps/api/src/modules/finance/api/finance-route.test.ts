import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { buildApp } from "../../../app.js";
import { db } from "../../../infrastructure/database/pool.js";
import { createMasterDataTestSession } from "../../core-platform/master-data/api/master-data-test-fixtures.js";

test("Finance accounting workflow validates accounts, journals, permissions, and company isolation", async () => {
  const fixture = await createMasterDataTestSession([
    "finance.accounts.read",
    "finance.accounts.create",
    "finance.journals.read",
    "finance.journals.create",
    "finance.journals.post",
  ]);
  const deniedFixture = await createMasterDataTestSession([]);
  const app = buildApp();
  const suffix = randomUUID().slice(0, 8);
  const cashCode = `CASH_${suffix}`;
  const revenueCode = `REV_${suffix}`;
  const foreignCompany = await db.query<{ id: string }>(
    `
      INSERT INTO core.companies (organization_id, code, name, status)
      VALUES ($1, $2, $3, 'ACTIVE')
      RETURNING id
    `,
    [fixture.organizationId, `FIN-OTH-${suffix}`, `Finance Other Company ${suffix}`],
  );

  try {
    const denied = await app.inject({
      method: "GET",
      url: "/api/v1/finance/accounts",
      headers: { authorization: `Bearer ${deniedFixture.token}` },
    });
    assert.equal(denied.statusCode, 403);

    const createCash = await app.inject({
      method: "POST",
      url: "/api/v1/finance/accounts",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        code: cashCode,
        name: "Cash on Hand",
        type: "ASSET",
        normalBalance: "DEBIT",
        description: "Operating cash account.",
      },
    });
    assert.equal(createCash.statusCode, 201);
    assert.equal(createCash.json().data.code, cashCode);

    const createRevenue = await app.inject({
      method: "POST",
      url: "/api/v1/finance/accounts",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        code: revenueCode,
        name: "Sales Revenue",
        type: "REVENUE",
        normalBalance: "CREDIT",
        description: "Revenue generated from sales.",
      },
    });
    assert.equal(createRevenue.statusCode, 201);

    const duplicateAccount = await app.inject({
      method: "POST",
      url: "/api/v1/finance/accounts",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        code: cashCode,
        name: "Cash on Hand Duplicate",
        type: "ASSET",
        normalBalance: "DEBIT",
      },
    });
    assert.equal(duplicateAccount.statusCode, 409);

    const fooAccountId = await db.query<{ id: string }>(
      `
        INSERT INTO finance.accounts (company_id, code, name, account_type, normal_balance, status)
        VALUES ($1, $2, $3, 'ASSET', 'DEBIT', 'ACTIVE')
        RETURNING id
      `,
      [foreignCompany.rows[0].id, `FOREIGN_${suffix}`, "Foreign account",],
    );

    const accountList = await app.inject({
      method: "GET",
      url: "/api/v1/finance/accounts",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(accountList.statusCode, 200);
    assert.ok(accountList.json().data.some((account: { code: string }) => account.code === cashCode));
    assert.ok(!accountList.json().data.some((account: { id: string }) => account.id === fooAccountId.rows[0].id));

    const invalidJournal = await app.inject({
      method: "POST",
      url: "/api/v1/finance/journals",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        description: "Unbalanced entry.",
        lines: [
          { accountCode: cashCode, debit: 250 },
          { accountCode: revenueCode, credit: 100 },
        ],
      },
    });
    assert.equal(invalidJournal.statusCode, 400);

    const validJournal = await app.inject({
      method: "POST",
      url: "/api/v1/finance/journals",
      headers: { authorization: `Bearer ${fixture.token}` },
      payload: {
        description: "Cash sale revenue recognition.",
        lines: [
          { accountCode: cashCode, debit: 2500 },
          { accountCode: revenueCode, credit: 2500 },
        ],
      },
    });
    assert.equal(validJournal.statusCode, 201);
    const journalId = validJournal.json().data.id;

    const postedJournal = await app.inject({
      method: "POST",
      url: `/api/v1/finance/journals/${journalId}/post`,
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(postedJournal.statusCode, 200);
    assert.equal(postedJournal.json().data.status, "POSTED");

    const secondPost = await app.inject({
      method: "POST",
      url: `/api/v1/finance/journals/${journalId}/post`,
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(secondPost.statusCode, 409);

    const journalList = await app.inject({
      method: "GET",
      url: "/api/v1/finance/journals",
      headers: { authorization: `Bearer ${fixture.token}` },
    });
    assert.equal(journalList.statusCode, 200);
    assert.ok(journalList.json().data.some((journal: { id: string }) => journal.id === journalId));
  } finally {
    await db.query("DELETE FROM finance.journal_lines WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM finance.journal_headers WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM finance.accounts WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM finance.fiscal_periods WHERE company_id = $1", [fixture.companyId]);
    await db.query("DELETE FROM finance.journal_lines WHERE company_id = $1", [foreignCompany.rows[0].id]);
    await db.query("DELETE FROM finance.journal_headers WHERE company_id = $1", [foreignCompany.rows[0].id]);
    await db.query("DELETE FROM finance.accounts WHERE company_id = $1", [foreignCompany.rows[0].id]);
    await db.query("DELETE FROM finance.fiscal_periods WHERE company_id = $1", [foreignCompany.rows[0].id]);
    await db.query("DELETE FROM core.companies WHERE id = $1", [foreignCompany.rows[0].id]);
    await fixture.cleanup();
    await deniedFixture.cleanup();
  }
});
