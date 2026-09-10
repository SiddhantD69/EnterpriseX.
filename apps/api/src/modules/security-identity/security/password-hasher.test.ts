import assert from "node:assert/strict";
import test from "node:test";

import {
  hashPassword,
  verifyPassword,
} from "./password-hasher.js";

test("hashPassword creates an Argon2id password hash", async () => {
  const password = "EnterpriseX-Test-Password-123!";

  const passwordHash = await hashPassword(password);

  assert.ok(passwordHash.startsWith("$argon2id$"));
  assert.notEqual(passwordHash, password);
});

test("verifyPassword accepts the correct password", async () => {
  const password = "EnterpriseX-Test-Password-123!";

  const passwordHash = await hashPassword(password);

  const verified = await verifyPassword(
    password,
    passwordHash,
  );

  assert.equal(verified, true);
});

test("verifyPassword rejects an incorrect password", async () => {
  const password = "EnterpriseX-Test-Password-123!";
  const incorrectPassword = "Wrong-Password-456!";

  const passwordHash = await hashPassword(password);

  const verified = await verifyPassword(
    incorrectPassword,
    passwordHash,
  );

  assert.equal(verified, false);
});

test("hashing the same password produces different hashes", async () => {
  const password = "EnterpriseX-Test-Password-123!";

  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);

  assert.notEqual(firstHash, secondHash);

  assert.equal(
    await verifyPassword(password, firstHash),
    true,
  );

  assert.equal(
    await verifyPassword(password, secondHash),
    true,
  );
});

test("hashPassword rejects an empty password", async () => {
  await assert.rejects(
    () => hashPassword(""),
    /Password is required/,
  );
});

test("verifyPassword safely rejects an empty password", async () => {
  const passwordHash = await hashPassword(
    "EnterpriseX-Test-Password-123!",
  );

  const verified = await verifyPassword(
    "",
    passwordHash,
  );

  assert.equal(verified, false);
});

test("verifyPassword safely rejects a malformed password hash", async () => {
  const verified = await verifyPassword(
    "EnterpriseX-Test-Password-123!",
    "not-a-valid-argon2-hash",
  );

  assert.equal(verified, false);
});