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
import {
  recordAccountLocked,
  recordLoginFailure,
  recordLoginSuccess,
  recordSessionCreated,
} from "./security-audit-service.js";

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
): Promise<boolean> => {
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

    return true;
  }

  return false;
};

const safeRecordAudit = async (
  operation: () => Promise<void>,
): Promise<void> => {
  try {
    await operation();
  } catch {
    /*
     * Authentication must not expose audit infrastructure
     * failures to the caller.
     *
     * The audit infrastructure itself is responsible for
     * observability of failed audit writes.
     */
  }
};

export const authenticateUser = async (
  input: LoginInput,
  now: Date = new Date(),
): Promise<LoginResult> => {
  const email = normalizeEmail(input.email);

  if (!email || !input.password) {
    await safeRecordAudit(() =>
      recordLoginFailure({
        userId: null,
        reason: "invalid_credentials",
      }),
    );

    throw new Error(
      INVALID_CREDENTIALS_MESSAGE,
    );
  }

  const user = await findUserByEmail(email);

  /*
   * Do not reveal whether the user exists.
   *
   * Perform password verification against a dummy
   * Argon2id hash when the account does not exist.
   */
  if (!user) {
    const dummyHash = await hashPassword(
      "EnterpriseX-Dummy-Authentication-Password",
    );

    await verifyPassword(
      input.password,
      dummyHash,
    );

    await safeRecordAudit(() =>
      recordLoginFailure({
        userId: null,
        reason: "invalid_credentials",
      }),
    );

    throw new Error(
      INVALID_CREDENTIALS_MESSAGE,
    );
  }

  if (user.status !== "ACTIVE") {
    await safeRecordAudit(() =>
      recordLoginFailure({
        userId: user.id,
        reason: "invalid_credentials",
      }),
    );

    throw new Error(
      INVALID_CREDENTIALS_MESSAGE,
    );
  }

  const credentials =
    await findCredentialsByUserId(user.id);

  if (
    !credentials ||
    !credentials.passwordHash
  ) {
    await safeRecordAudit(() =>
      recordLoginFailure({
        userId: user.id,
        reason: "invalid_credentials",
      }),
    );

    throw new Error(
      INVALID_CREDENTIALS_MESSAGE,
    );
  }

  if (
    isLocked(
      credentials.lockedUntil,
      now,
    )
  ) {
    await safeRecordAudit(() =>
      recordLoginFailure({
        userId: user.id,
        reason: "account_locked",
      }),
    );

    throw new Error(
      INVALID_CREDENTIALS_MESSAGE,
    );
  }

  const passwordValid =
    await verifyPassword(
      input.password,
      credentials.passwordHash,
    );

  if (!passwordValid) {
    const accountLocked =
      await registerFailedLogin(
        user.id,
        credentials.failedLoginAttempts,
        now,
      );

    await safeRecordAudit(() =>
      recordLoginFailure({
        userId: user.id,
        reason: "invalid_credentials",
      }),
    );

    if (accountLocked) {
      await safeRecordAudit(() =>
        recordAccountLocked({
          userId: user.id,
        }),
      );
    }

    throw new Error(
      INVALID_CREDENTIALS_MESSAGE,
    );
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

  await safeRecordAudit(() =>
    recordSessionCreated({
      userId: user.id,
      sessionId: session.session.id,
    }),
  );

  await safeRecordAudit(() =>
    recordLoginSuccess({
      userId: user.id,
    }),
  );

  return {
    user,
    session,
  };
};