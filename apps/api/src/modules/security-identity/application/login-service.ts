import {
  findCredentialsByUserId,
  lockUserUntil,
  recordFailedLoginAttempt,
  resetLoginFailures,
} from "../infrastructure/credential-repository.js";
import {
  findUserByEmail,
  type SecurityUser,
} from "../infrastructure/user-repository.js";
import {
  createAuthenticatedSession,
  type CreatedSession,
} from "./session-service.js";
import {
  hashPassword,
  verifyPassword,
} from "../security/password-hasher.js";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_LIFETIME_MINUTES = 60;

export const INVALID_CREDENTIALS_MESSAGE =
  "Invalid email or password.";

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResult = {
  user: SecurityUser;
  session: CreatedSession;
};

const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

const isLocked = (
  lockedUntil: Date | null,
  now: Date = new Date(),
): boolean => {
  return (
    lockedUntil !== null &&
    lockedUntil.getTime() > now.getTime()
  );
};

const registerFailedLogin = async (
  userId: string,
  failedAttempts: number,
  now: Date,
): Promise<void> => {
  const nextAttempts = failedAttempts + 1;

  await recordFailedLoginAttempt(userId);

  if (nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    const lockedUntil = new Date(
      now.getTime() +
        LOCKOUT_MINUTES * 60 * 1000,
    );

    await lockUserUntil(
      userId,
      lockedUntil,
    );
  }
};

export const authenticateUser = async (
  input: LoginInput,
  now: Date = new Date(),
): Promise<LoginResult> => {
  const email = normalizeEmail(input.email);

  if (!email || !input.password) {
    throw new Error(INVALID_CREDENTIALS_MESSAGE);
  }

  const user = await findUserByEmail(email);

  /*
   * Do not reveal whether the user exists.
   *
   * If no user exists, perform the same password-hash
   * operation against a generated dummy hash so that the
   * response path is not trivially distinguishable.
   */
  if (!user) {
    const dummyHash = await hashPassword(
      "EnterpriseX-Dummy-Authentication-Password",
    );

    await verifyPassword(
      input.password,
      dummyHash,
    );

    throw new Error(INVALID_CREDENTIALS_MESSAGE);
  }

  if (user.status !== "ACTIVE") {
    throw new Error(INVALID_CREDENTIALS_MESSAGE);
  }

  const credentials =
    await findCredentialsByUserId(user.id);

  if (!credentials || !credentials.passwordHash) {
    throw new Error(INVALID_CREDENTIALS_MESSAGE);
  }

  if (
    isLocked(
      credentials.lockedUntil,
      now,
    )
  ) {
    throw new Error(INVALID_CREDENTIALS_MESSAGE);
  }

  const passwordValid =
    await verifyPassword(
      input.password,
      credentials.passwordHash,
    );

  if (!passwordValid) {
    await registerFailedLogin(
      user.id,
      credentials.failedLoginAttempts,
      now,
    );

    throw new Error(INVALID_CREDENTIALS_MESSAGE);
  }

  await resetLoginFailures(
    user.id,
    now,
  );

  const session =
    await createAuthenticatedSession({
      userId: user.id,
      lifetimeMinutes:
        SESSION_LIFETIME_MINUTES,
    });

  return {
    user,
    session,
  };
};