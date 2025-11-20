-- ============================
-- TABLE: users
-- ============================
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username      VARCHAR(100) UNIQUE,      -- For local login
    ms_email      VARCHAR(255) UNIQUE,      -- For Microsoft login
    password_hash TEXT,                     -- bcrypt hash
    role          VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'CLIENTA', 'CLIENTB')),
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================
-- TABLE: login_audit
-- ============================
DROP TABLE IF EXISTS login_audit CASCADE;

CREATE TABLE login_audit (
    id SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    login_method VARCHAR(50),        -- 'password' | 'microsoft'
    ip_address   VARCHAR(100),
    user_agent   TEXT,
    timestamp    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
