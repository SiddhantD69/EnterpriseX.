import argon2 from "argon2";

export const hashPassword = async (
  password: string,
): Promise<string> => {
  if (!password) {
    throw new Error("Password is required.");
  }

  return argon2.hash(password, {
    type: argon2.argon2id,
  });
};

export const verifyPassword = async (
  password: string,
  passwordHash: string,
): Promise<boolean> => {
  if (!password || !passwordHash) {
    return false;
  }

  try {
    return await argon2.verify(
      passwordHash,
      password,
    );
  } catch {
    return false;
  }
};