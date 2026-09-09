import {
  createHash,
  randomBytes,
} from "node:crypto";

const SESSION_TOKEN_BYTES = 32;

export const generateSessionToken = (): string => {
  return randomBytes(SESSION_TOKEN_BYTES).toString("hex");
};

export const hashSessionToken = (
  token: string,
): string => {
  return createHash("sha256")
    .update(token)
    .digest("hex");
};