export type SessionStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "REVOKED";

export type Session = {
  id: string;
  userId: string;
  tokenHash: string;
  status: SessionStatus;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
};

export type CreateSessionInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export const isSessionExpired = (
  session: Session,
  now: Date = new Date(),
): boolean => {
  return session.expiresAt.getTime() <= now.getTime();
};

export const isSessionActive = (
  session: Session,
  now: Date = new Date(),
): boolean => {
  return (
    session.status === "ACTIVE" &&
    !isSessionExpired(session, now)
  );
};