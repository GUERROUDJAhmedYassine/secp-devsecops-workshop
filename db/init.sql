CREATE SCHEMA app;
CREATE SCHEMA siem;

CREATE TYPE app.user_role AS ENUM ('EMPLOYEE', 'MANAGER', 'IT_ADMIN');

CREATE TABLE app.users (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    username        VARCHAR(50)      UNIQUE NOT NULL,
    email           VARCHAR(100)     UNIQUE NOT NULL,
    password_hash   VARCHAR(255)     NOT NULL,
    role            app.user_role    NOT NULL,
    department      VARCHAR(100),
    is_active       BOOLEAN          DEFAULT TRUE,
    failed_logins   INTEGER          DEFAULT 0,
    locked_until    TIMESTAMP        NULL,
    vpn_public_key  TEXT             NULL,
    last_login_at   TIMESTAMP        NULL,
    created_at      TIMESTAMP        DEFAULT NOW()
);

CREATE TABLE app.refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id     UUID         NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    token       TEXT         NOT NULL UNIQUE,
    is_revoked  BOOLEAN      DEFAULT FALSE,
    expires_at  TIMESTAMP    NOT NULL,
    created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE app.rooms (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    department  VARCHAR(100),
    created_by  UUID         NOT NULL REFERENCES app.users(id),
    created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE app.room_members (
    room_id    UUID      NOT NULL REFERENCES app.rooms(id) ON DELETE CASCADE,
    user_id    UUID      NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    joined_at  TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);
CREATE TABLE app.emails (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    sender_id       UUID         NOT NULL REFERENCES app.users(id),
    recipient_id    UUID         NOT NULL REFERENCES app.users(id),
    subject         VARCHAR(500) NOT NULL,
    body            TEXT,
    has_attachment  BOOLEAN      DEFAULT FALSE,
    attachment_path TEXT         NULL,
    is_read         BOOLEAN      DEFAULT FALSE,
    is_deleted      BOOLEAN      DEFAULT FALSE,
    sent_at         TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE app.messages (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    sender_id       UUID    NOT NULL REFERENCES app.users(id),
    recipient_id    UUID    NULL     REFERENCES app.users(id),
    room_id         UUID    NULL     REFERENCES app.rooms(id),
    content         TEXT    NOT NULL,
    is_deleted      BOOLEAN DEFAULT FALSE,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_message_target CHECK (
        (recipient_id IS NOT NULL AND room_id IS NULL) OR
        (recipient_id IS NULL AND room_id IS NOT NULL)
    )
);
CREATE TABLE app.files (
    id              UUID PRIMARY KEY DEFAULT uuidv7(),
    owner_id        UUID         NOT NULL REFERENCES app.users(id),
    filename        VARCHAR(255) NOT NULL,
    file_size       BIGINT,
    mime_type       VARCHAR(100),
    storage_path    TEXT         NOT NULL,
    bucket          VARCHAR(100) NOT NULL,
    is_deleted      BOOLEAN      DEFAULT FALSE,
    uploaded_at     TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE siem.events (
    id          BIGSERIAL    PRIMARY KEY,
    event_type  VARCHAR(50)  NOT NULL,
    severity    VARCHAR(10)  NOT NULL,
    service     VARCHAR(20)  NOT NULL,
    user_id     UUID         NULL REFERENCES app.users(id),
    source_ip   INET         NULL,
    payload     JSONB        NOT NULL DEFAULT '{}',
    created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE siem.alerts (
    id          UUID PRIMARY KEY DEFAULT uuidv7(),
    alert_type  VARCHAR(50)  NOT NULL,
    severity    VARCHAR(10)  NOT NULL,
    user_id     UUID         NOT NULL REFERENCES app.users(id),
    description TEXT         NOT NULL,
    evidence    JSONB        NOT NULL DEFAULT '{}',
    status      VARCHAR(15)  DEFAULT 'OPEN',
    created_at  TIMESTAMP    DEFAULT NOW(),
    resolved_at TIMESTAMP    NULL
);

CREATE TABLE siem.user_baselines (
    user_id          UUID  PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
    avg_login_hour   FLOAT DEFAULT 12.0,
    known_ips        INET[] DEFAULT '{}',
    avg_messages_day FLOAT DEFAULT 0.0,
    avg_files_day    FLOAT DEFAULT 0.0,
    avg_emails_day   FLOAT DEFAULT 0.0,
    confidence       FLOAT DEFAULT 0.0,
    tx_count         INTEGER DEFAULT 0,
    last_updated     TIMESTAMP DEFAULT NOW()
);


CREATE OR REPLACE FUNCTION siem.prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'siem.events is append-only. Modification is prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_append_only
    BEFORE UPDATE OR DELETE ON siem.events
    FOR EACH ROW EXECUTE FUNCTION siem.prevent_modification();

-- ============================================================
-- 5. INDEXES — for detection engine query performance
-- ============================================================

-- Detection engine queries events by user + type + time window
CREATE INDEX idx_events_user_type_time
    ON siem.events (user_id, event_type, created_at);

-- Time-range queries on full event log
CREATE INDEX idx_events_created_at
    ON siem.events (created_at);

-- Fast lookup of open alerts per user
CREATE INDEX idx_alerts_user_status
    ON siem.alerts (user_id, status);

-- Fast email inbox/sent queries
CREATE INDEX idx_emails_recipient
    ON app.emails (recipient_id, sent_at);

CREATE INDEX idx_emails_sender
    ON app.emails (sender_id, sent_at);

-- Fast message queries per room and per DM
CREATE INDEX idx_messages_room
    ON app.messages (room_id, created_at);

CREATE INDEX idx_messages_dm
    ON app.messages (sender_id, recipient_id, created_at);

-- Fast file queries per owner and bucket
CREATE INDEX idx_files_owner
    ON app.files (owner_id, bucket);

-- ============================================================
-- 6. SCHEMA PERMISSIONS
-- Only siem service user can write to siem schema
-- App services cannot write directly to siem schema
-- ============================================================

CREATE ROLE app_service LOGIN PASSWORD 'change_in_production';
CREATE ROLE siem_service LOGIN PASSWORD 'change_in_production';

-- App service: full access to app schema only
GRANT USAGE ON SCHEMA app TO app_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO app_service;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO app_service;

-- App service: can READ siem schema (for dashboard queries)
GRANT USAGE ON SCHEMA siem TO app_service;
GRANT SELECT ON ALL TABLES IN SCHEMA siem TO app_service;

-- Siem service: full access to siem schema
GRANT USAGE ON SCHEMA siem TO siem_service;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA siem TO siem_service;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA siem TO siem_service;

-- Siem service also needs to read app.users (for FK resolution)
GRANT USAGE ON SCHEMA app TO siem_service;
GRANT SELECT ON app.users TO siem_service;
