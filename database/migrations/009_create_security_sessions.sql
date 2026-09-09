CREATE TABLE IF NOT EXISTS security.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    token_hash VARCHAR(128) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ NOT NULL,

    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    revoked_at TIMESTAMPTZ,

    CONSTRAINT uq_security_sessions_token_hash
        UNIQUE (token_hash),

    CONSTRAINT ck_security_sessions_status
        CHECK (
            status IN ('ACTIVE', 'EXPIRED', 'REVOKED')
        ),

    CONSTRAINT ck_security_sessions_expiry
        CHECK (
            expires_at > created_at
        ),

    CONSTRAINT ck_security_sessions_revocation
        CHECK (
            (status = 'REVOKED' AND revoked_at IS NOT NULL)
            OR
            (status <> 'REVOKED' AND revoked_at IS NULL)
        ),

    CONSTRAINT fk_security_sessions_user
        FOREIGN KEY (user_id)
        REFERENCES security.users(id)
);

CREATE INDEX IF NOT EXISTS idx_security_sessions_user_id
    ON security.sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_security_sessions_active_expiry
    ON security.sessions(status, expires_at)
    WHERE status = 'ACTIVE';