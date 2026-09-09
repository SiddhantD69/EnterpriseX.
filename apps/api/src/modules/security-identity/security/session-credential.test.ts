import {
  describe,
  it,
} from "node:test";

import assert from "node:assert/strict";

import {
  generateSessionToken,
  hashSessionToken,
} from "./session-credential.js";

describe("Session Credential", () => {
  it("generates a 64-character hexadecimal token", () => {
    const token = generateSessionToken();

    assert.equal(token.length, 64);
    assert.match(token, /^[0-9a-f]+$/);
  });

  it("generates different tokens", () => {
    const firstToken = generateSessionToken();
    const secondToken = generateSessionToken();

    assert.notEqual(firstToken, secondToken);
  });

  it("produces a 64-character SHA-256 hash", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);

    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]+$/);
  });

  it("produces the same hash for the same token", () => {
    const token = generateSessionToken();

    const firstHash = hashSessionToken(token);
    const secondHash = hashSessionToken(token);

    assert.equal(firstHash, secondHash);
  });

  it("produces different hashes for different tokens", () => {
    const firstToken = generateSessionToken();
    const secondToken = generateSessionToken();

    const firstHash = hashSessionToken(firstToken);
    const secondHash = hashSessionToken(secondToken);

    assert.notEqual(firstHash, secondHash);
  });

  it("does not return the original token as its hash", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);

    assert.notEqual(hash, token);
  });
});