# ADAM AI - Production Readiness Implementation Plan

**Created:** November 20, 2025
**Status:** In Progress
**Target Completion:** Q2 2026 (18 months)
**Priority:** CRITICAL - FDA Compliance Required

---

## EXECUTIVE SUMMARY

This document outlines the comprehensive implementation plan to transform ADAM AI from a prototype to a production-ready, FDA-compliant, CDISC-focused SaaS product for clinical trial data management. The plan addresses all critical gaps identified in the criticism.md analysis.

**Current State:** 4.5/10 - NOT PRODUCTION READY
**Target State:** 9.5/10 - PRODUCTION READY, FDA COMPLIANT

---

## TABLE OF CONTENTS

1. [Critical Priorities](#critical-priorities)
2. [Phase 1: Security & Authentication](#phase-1-security--authentication-weeks-1-2)
3. [Phase 2: Database & Persistence](#phase-2-database--persistence-weeks-3-5)
4. [Phase 3: 21 CFR Part 11 Compliance](#phase-3-21-cfr-part-11-compliance-weeks-6-10)
5. [Phase 4: CDISC Compliance Enhancement](#phase-4-cdisc-compliance-enhancement-weeks-11-16)
6. [Phase 5: Testing & Quality Assurance](#phase-5-testing--quality-assurance-weeks-17-22)
7. [Phase 6: Operational Infrastructure](#phase-6-operational-infrastructure-weeks-23-28)
8. [Phase 7: Production Deployment](#phase-7-production-deployment-weeks-29-32)
9. [Architecture Decisions](#architecture-decisions)
10. [Risk Assessment & Mitigation](#risk-assessment--mitigation)

---

## CRITICAL PRIORITIES

### Must-Fix-Immediately (Week 1)
1. ✅ SECRET_KEY moved to environment variables (DONE)
2. Remove/replace hardcoded test passwords
3. Add authentication middleware to ALL sensitive endpoints
4. Implement HTTPS enforcement
5. Set up basic audit logging to database

### Regulatory Blockers (Weeks 2-10)
1. Implement persistent database (PostgreSQL)
2. 21 CFR Part 11 compliance implementation
3. E-signature support
4. Immutable audit trails
5. Data integrity verification

### CDISC Compliance (Weeks 11-16)
1. Executable rule engine (not just descriptive)
2. CDISC Controlled Terminology integration
3. Cross-variable validation
4. Define-XML v2.1 generation
5. Support for ADAM IG v2.1

---

## PHASE 1: SECURITY & AUTHENTICATION (Weeks 1-2)

### Objective
Eliminate all critical security vulnerabilities and implement enterprise-grade authentication.

### 1.1 Secrets Management

**Implementation:**
```python
# Use python-decouple or secrets manager
from decouple import config
import secrets

# Generate cryptographically secure secret
SECRET_KEY = config('SECRET_KEY', default=secrets.token_urlsafe(32))

# For production, use AWS Secrets Manager or Azure Key Vault
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential()
client = SecretClient(vault_url="https://adamai-vault.vault.azure.net/", credential=credential)
SECRET_KEY = client.get_secret("JWTSecretKey").value
```

**Tasks:**
- [ ] Add `python-decouple` to requirements.txt
- [ ] Update `.env.example` with all required secrets
- [ ] Add secrets validation on startup
- [ ] Implement Azure Key Vault integration (optional for enterprise)
- [ ] Remove all hardcoded credentials from source code

### 1.2 Password Policy & User Management

**Implementation:**
```python
from passlib.context import CryptContext
from pydantic import BaseModel, Field, validator
import re

class PasswordPolicy(BaseModel):
    min_length: int = 12
    require_uppercase: bool = True
    require_lowercase: bool = True
    require_digits: bool = True
    require_special: bool = True
    expiration_days: int = 90
    prevent_reuse: int = 5  # Last 5 passwords

class CreateUserRequest(BaseModel):
    username: str
    email: EmailStr
    password: str = Field(..., min_length=12)

    @validator('password')
    def validate_password(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain digit')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Password must contain special character')
        return v
```

**Tasks:**
- [ ] Implement PasswordPolicy model
- [ ] Add password complexity validation
- [ ] Implement password expiration tracking
- [ ] Add password history to prevent reuse
- [ ] Implement account lockout after failed attempts (5 tries)
- [ ] Add password reset flow with email verification

### 1.3 Multi-Factor Authentication (MFA)

**Implementation:**
```python
import pyotp
from qrcode import make as make_qr

class MFAService:
    @staticmethod
    def generate_secret() -> str:
        """Generate TOTP secret for user"""
        return pyotp.random_base32()

    @staticmethod
    def verify_token(secret: str, token: str) -> bool:
        """Verify TOTP token"""
        totp = pyotp.TOTP(secret)
        return totp.verify(token, valid_window=1)

    @staticmethod
    def get_provisioning_uri(secret: str, email: str) -> str:
        """Get QR code provisioning URI"""
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(email, issuer_name="ADAM AI")
```

**Tasks:**
- [ ] Add `pyotp` and `qrcode` to requirements.txt
- [ ] Implement MFA setup endpoint
- [ ] Implement MFA verification in login flow
- [ ] Add backup codes generation
- [ ] Store MFA secret encrypted in database

### 1.4 Endpoint Authentication

**Current State Analysis:**
| Endpoint Group | Auth Status | Required Action |
|---|---|---|
| /auth/* | ❌ Public (correct) | No change |
| /specification/* | ❌ No Auth | ✅ Add auth |
| /code-generation/* | ❌ No Auth | ✅ Add auth |
| /code-execution/* | ❌ No Auth | ✅ Add auth |
| /traceability/* | ❌ No Auth | ✅ Add auth |
| /program-generation/* | ❌ No Auth | ✅ Add auth |
| /test-data/* | ❌ No Auth | ✅ Add auth |
| /llm/* | ❌ No Auth | ✅ Add auth |
| /validation/* | ✅ Has Auth | No change |
| /reviews/* | ✅ Has Auth | No change |

**Implementation:**
```python
from fastapi import Depends
from app.core.auth import get_current_active_user, require_role

# Add authentication dependency to all routes
@router.post("/code-generation/generate")
async def generate_code(
    request: CodeGenerationRequest,
    current_user: User = Depends(get_current_active_user)
):
    # Audit log
    await audit_log(
        user_id=current_user.username,
        action="CODE_GENERATION_STARTED",
        resource_type="code_snippet",
        metadata={"variables": len(request.variables)}
    )

    # Implementation
    ...
```

**Tasks:**
- [ ] Add `Depends(get_current_active_user)` to all sensitive endpoints
- [ ] Implement role-based access control (RBAC)
- [ ] Add audit logging to all protected endpoints
- [ ] Update API documentation with authentication requirements
- [ ] Add unit tests for authentication middleware

### 1.5 HTTPS/TLS Enforcement

**Implementation:**
```python
# main.py
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

if not settings.DEBUG:
    app.add_middleware(HTTPSRedirectMiddleware)

# Nginx configuration for production
server {
    listen 80;
    server_name adamai.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name adamai.com;

    ssl_certificate /etc/ssl/certs/adamai.crt;
    ssl_certificate_key /etc/ssl/private/adamai.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Tasks:**
- [ ] Obtain SSL/TLS certificates (Let's Encrypt or commercial)
- [ ] Configure Nginx as reverse proxy
- [ ] Enable HTTPS redirect middleware
- [ ] Update CORS settings for HTTPS origins
- [ ] Add HSTS header for security

---

## PHASE 2: DATABASE & PERSISTENCE (Weeks 3-5)

### Objective
Implement production-grade PostgreSQL database with complete audit trail persistence.

### 2.1 Database Architecture

**Technology Stack:**
- **Database:** PostgreSQL 15+
- **ORM:** SQLAlchemy 2.0 (async)
- **Migrations:** Alembic
- **Connection Pool:** asyncpg
- **Backup:** pg_dump + S3 storage

**Schema Design:**

```sql
-- Core Tables

-- Users and Authentication
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    mfa_secret VARCHAR(255),  -- Encrypted TOTP secret
    mfa_enabled BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    password_expires_at TIMESTAMP,
    last_password_change TIMESTAMP,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id)
);

-- Password History (for reuse prevention)
CREATE TABLE password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    hashed_password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions
CREATE TABLE sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organizations/Sponsors
CREATE TABLE organizations (
    org_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Projects/Studies
CREATE TABLE projects (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id VARCHAR(100) UNIQUE NOT NULL,
    protocol_number VARCHAR(100),
    sponsor_org_id UUID REFERENCES organizations(org_id),
    study_name VARCHAR(500),
    therapeutic_area VARCHAR(100),
    indication TEXT,
    phase VARCHAR(20),  -- Phase I, II, III, IV
    adam_ig_version VARCHAR(20) DEFAULT '2.1',
    sdtm_version VARCHAR(20),
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active'  -- active, archived, deleted
);

-- Project Team Members
CREATE TABLE project_members (
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,  -- lead_programmer, programmer, reviewer
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(user_id),
    PRIMARY KEY (project_id, user_id)
);

-- Specifications
CREATE TABLE specifications (
    spec_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    dataset_name VARCHAR(50) NOT NULL,  -- ADSL, ADAE, ADLB, etc.
    spec_version VARCHAR(20),
    file_name VARCHAR(255),
    file_path TEXT,
    file_hash VARCHAR(64),  -- SHA-256 hash for integrity
    uploaded_by UUID REFERENCES users(user_id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parsed_content JSONB,  -- Structured specification data
    parsing_status VARCHAR(50) DEFAULT 'pending',
    parsing_errors JSONB
);

-- Variables Metadata
CREATE TABLE variables (
    variable_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spec_id UUID REFERENCES specifications(spec_id) ON DELETE CASCADE,
    variable_name VARCHAR(100) NOT NULL,
    label TEXT,
    type VARCHAR(20),  -- Char, Num
    length INT,
    format VARCHAR(50),
    category VARCHAR(50),  -- IDENTIFIER, TIMING, DEMOGRAPHIC, etc.
    source_variables TEXT[],  -- Array of SDTM variables
    derivation_algorithm TEXT,
    cdisc_ig_rule VARCHAR(100),
    controlled_terminology VARCHAR(100),
    is_required BOOLEAN DEFAULT FALSE,
    sequence_number INT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Code Snippets
CREATE TABLE code_snippets (
    snippet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    spec_id UUID REFERENCES specifications(spec_id),
    variable_id UUID REFERENCES variables(variable_id),
    variable_name VARCHAR(100) NOT NULL,
    language VARCHAR(10) CHECK (language IN ('R', 'SAS')),
    code_content TEXT NOT NULL,
    code_hash VARCHAR(64),  -- SHA-256 for integrity
    version INT DEFAULT 1,
    parent_snippet_id UUID REFERENCES code_snippets(snippet_id),  -- For versioning
    llm_provider VARCHAR(50),
    llm_model VARCHAR(100),
    generation_time_ms INT,
    prompt_tokens INT,
    completion_tokens INT,
    status VARCHAR(50) DEFAULT 'generated',  -- generated, reviewed, approved, rejected
    validation_results JSONB,
    reviewed_by UUID REFERENCES users(user_id),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP,
    e_signature VARCHAR(500),  -- 21 CFR Part 11 electronic signature
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consolidated Programs
CREATE TABLE programs (
    program_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    spec_id UUID REFERENCES specifications(spec_id),
    dataset_name VARCHAR(50) NOT NULL,
    language VARCHAR(10) CHECK (language IN ('R', 'SAS')),
    program_content TEXT NOT NULL,
    program_hash VARCHAR(64),
    version INT DEFAULT 1,
    parent_program_id UUID REFERENCES programs(program_id),
    generation_method VARCHAR(50),  -- manual, automated, hybrid
    snippet_count INT,
    validation_status VARCHAR(50),
    test_results JSONB,
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP,
    e_signature VARCHAR(500)
);

-- Program-Snippet Mapping
CREATE TABLE program_snippets (
    program_id UUID REFERENCES programs(program_id) ON DELETE CASCADE,
    snippet_id UUID REFERENCES code_snippets(snippet_id) ON DELETE CASCADE,
    sequence_order INT NOT NULL,
    included_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (program_id, snippet_id)
);

-- Test Datasets
CREATE TABLE test_datasets (
    dataset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    dataset_name VARCHAR(50) NOT NULL,  -- DM, AE, LB, etc.
    dataset_type VARCHAR(20),  -- SDTM, ADAM
    file_name VARCHAR(255),
    file_path TEXT,
    file_hash VARCHAR(64),
    row_count INT,
    column_count INT,
    generated_by VARCHAR(50),  -- manual, faker, imported
    uploaded_by UUID REFERENCES users(user_id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Test Execution Results
CREATE TABLE test_executions (
    execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snippet_id UUID REFERENCES code_snippets(snippet_id),
    program_id UUID REFERENCES programs(program_id),
    language VARCHAR(10),
    execution_status VARCHAR(50),  -- success, error, timeout
    output_log TEXT,
    error_log TEXT,
    output_datasets JSONB,  -- Array of generated dataset info
    execution_time_ms INT,
    executed_by UUID REFERENCES users(user_id),
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Traceability Matrix
CREATE TABLE traceability_links (
    link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    spec_id UUID REFERENCES specifications(spec_id),
    variable_id UUID REFERENCES variables(variable_id),
    snippet_id UUID REFERENCES code_snippets(snippet_id),
    adam_variable VARCHAR(100),
    sdtm_variables TEXT[],
    cdisc_ig_rule VARCHAR(100),
    confidence_score DECIMAL(3,2),  -- 0.00 to 1.00
    verification_status VARCHAR(50),  -- unverified, verified, flagged
    verified_by UUID REFERENCES users(user_id),
    verified_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 21 CFR Part 11 Audit Trail (IMMUTABLE)
CREATE TABLE audit_trail (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID REFERENCES users(user_id),
    username VARCHAR(100) NOT NULL,
    session_id UUID REFERENCES sessions(session_id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    before_state JSONB,
    after_state JSONB,
    change_summary TEXT,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    regulatory_reason TEXT,  -- Required for 21 CFR Part 11
    e_signature VARCHAR(500),  -- Electronic signature if applicable
    metadata JSONB,
    -- Immutability constraints
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Hash chain for tamper detection
    previous_hash VARCHAR(64),
    current_hash VARCHAR(64) NOT NULL
);

-- Electronic Signatures Log
CREATE TABLE electronic_signatures (
    signature_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID NOT NULL,
    signature_meaning VARCHAR(100) NOT NULL,  -- approved, reviewed, authored
    signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    signature_hash VARCHAR(255) NOT NULL,  -- Cryptographic signature
    reason TEXT NOT NULL,  -- Required by 21 CFR Part 11
    ip_address INET,
    is_valid BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMP,
    revoked_by UUID REFERENCES users(user_id),
    revocation_reason TEXT
);

-- System Configuration & Settings
CREATE TABLE system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(user_id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- LLM Provider Configuration
CREATE TABLE llm_providers (
    provider_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_name VARCHAR(50) UNIQUE NOT NULL,
    api_endpoint VARCHAR(255),
    is_enabled BOOLEAN DEFAULT TRUE,
    rate_limit_per_minute INT,
    rate_limit_per_day INT,
    default_model VARCHAR(100),
    default_temperature DECIMAL(3,2),
    default_max_tokens INT,
    configuration JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- LLM Usage Tracking (for cost monitoring)
CREATE TABLE llm_usage (
    usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    project_id UUID REFERENCES projects(project_id),
    provider_id UUID REFERENCES llm_providers(provider_id),
    model_name VARCHAR(100),
    operation_type VARCHAR(50),  -- code_generation, validation, etc.
    prompt_tokens INT,
    completion_tokens INT,
    total_cost DECIMAL(10,4),
    response_time_ms INT,
    success BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CDISC Controlled Terminology Cache
CREATE TABLE cdisc_terminology (
    term_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codelist_name VARCHAR(100) NOT NULL,
    codelist_code VARCHAR(100),
    term_value VARCHAR(255) NOT NULL,
    term_code VARCHAR(50),
    definition TEXT,
    cdisc_submission_value VARCHAR(100),
    nci_code VARCHAR(50),
    effective_date DATE,
    deprecated_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Define-XML Metadata
CREATE TABLE define_xml_metadata (
    define_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    dataset_name VARCHAR(50) NOT NULL,
    define_version VARCHAR(20) DEFAULT '2.1',
    xml_content TEXT,
    xml_hash VARCHAR(64),
    generated_by UUID REFERENCES users(user_id),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP
);

-- INDEXES for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_projects_study_id ON projects(study_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_code_snippets_project_id ON code_snippets(project_id);
CREATE INDEX idx_code_snippets_variable_name ON code_snippets(variable_name);
CREATE INDEX idx_code_snippets_status ON code_snippets(status);
CREATE INDEX idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX idx_audit_trail_timestamp ON audit_trail(timestamp DESC);
CREATE INDEX idx_audit_trail_resource ON audit_trail(resource_type, resource_id);
CREATE INDEX idx_llm_usage_project_id ON llm_usage(project_id);
CREATE INDEX idx_llm_usage_created_at ON llm_usage(created_at DESC);

-- Triggers for audit trail hash chain
CREATE OR REPLACE FUNCTION calculate_audit_hash()
RETURNS TRIGGER AS $$
DECLARE
    prev_hash VARCHAR(64);
    hash_input TEXT;
BEGIN
    -- Get previous hash
    SELECT current_hash INTO prev_hash
    FROM audit_trail
    ORDER BY timestamp DESC
    LIMIT 1;

    -- Calculate new hash
    hash_input := CONCAT(
        prev_hash,
        NEW.timestamp::TEXT,
        NEW.user_id::TEXT,
        NEW.action,
        COALESCE(NEW.resource_type, ''),
        COALESCE(NEW.resource_id::TEXT, '')
    );

    NEW.previous_hash := prev_hash;
    NEW.current_hash := encode(digest(hash_input, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_trail_hash_trigger
BEFORE INSERT ON audit_trail
FOR EACH ROW
EXECUTE FUNCTION calculate_audit_hash();

-- Prevent updates/deletes on audit trail (immutability)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit trail records cannot be modified or deleted (21 CFR Part 11 compliance)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_update
BEFORE UPDATE ON audit_trail
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER prevent_audit_delete
BEFORE DELETE ON audit_trail
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_modification();
```

### 2.2 SQLAlchemy Models

**Tasks:**
- [ ] Create database models in `backend/app/models/db/`
- [ ] Implement async database session management
- [ ] Set up connection pooling with asyncpg
- [ ] Create database initialization scripts
- [ ] Implement model serialization/deserialization

### 2.3 Alembic Migrations

**Tasks:**
- [ ] Initialize Alembic
- [ ] Create initial migration
- [ ] Set up migration automation in CI/CD
- [ ] Document migration procedures
- [ ] Implement rollback testing

### 2.4 Data Migration from In-Memory

**Tasks:**
- [ ] Create migration scripts for existing test users
- [ ] Implement data preservation strategy
- [ ] Test migration rollback
- [ ] Document migration process
- [ ] Validate data integrity post-migration

---

## PHASE 3: 21 CFR PART 11 COMPLIANCE (Weeks 6-10)

### Objective
Implement complete 21 CFR Part 11 compliance for electronic records and electronic signatures.

### 3.1 Electronic Signatures

**Implementation:**
```python
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend

class ElectronicSignature:
    @staticmethod
    def sign_document(user_id: str, document_hash: str, reason: str, password: str) -> dict:
        """
        Create electronic signature following 21 CFR Part 11

        Requirements:
        - User identification (username)
        - Password verification
        - Signature meaning (approval, review, authoring)
        - Date and time stamp
        - Reason for signing
        """
        # Verify user password
        user = await db.get_user(user_id)
        if not verify_password(password, user.hashed_password):
            raise HTTPException(401, "Invalid password for signature")

        # Create signature components
        signature_data = {
            "user_id": user_id,
            "username": user.username,
            "document_hash": document_hash,
            "timestamp": datetime.utcnow().isoformat(),
            "reason": reason,
            "meaning": "approved",  # or "reviewed", "authored"
        }

        # Generate cryptographic signature
        private_key = user.get_private_key()  # Securely stored
        signature_bytes = private_key.sign(
            json.dumps(signature_data).encode(),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )

        # Store in database
        e_sig = await db.create_electronic_signature(
            user_id=user_id,
            resource_type="code_snippet",
            resource_id=document_id,
            signature_hash=signature_bytes.hex(),
            reason=reason,
            signature_meaning="approved"
        )

        return e_sig
```

**Tasks:**
- [ ] Implement electronic signature service
- [ ] Add signature verification endpoints
- [ ] Create signature audit log
- [ ] Implement signature revocation
- [ ] Add UI for signature capture with reason

### 3.2 Immutable Audit Trail

**Implementation:**
```python
class AuditService:
    @staticmethod
    async def log_action(
        user_id: str,
        action: str,
        resource_type: str,
        resource_id: str,
        before_state: dict = None,
        after_state: dict = None,
        reason: str = None
    ):
        """
        Create immutable audit trail entry
        Uses blockchain-style hash chaining for tamper detection
        """
        entry = AuditEntry(
            user_id=user_id,
            username=user.username,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            before_state=before_state,
            after_state=after_state,
            regulatory_reason=reason,
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent"),
            success=True
        )

        # Hash chaining handled by database trigger
        await db.insert_audit_entry(entry)

        return entry
```

**Tasks:**
- [ ] Implement audit trail service with hash chaining
- [ ] Add audit log verification endpoints
- [ ] Create audit log export (PDF, CSV)
- [ ] Implement audit log search and filtering
- [ ] Add tamper detection alerts

### 3.3 Data Integrity Verification

**Implementation:**
```python
class DataIntegrityService:
    @staticmethod
    async def calculate_checksum(data: dict) -> str:
        """Calculate SHA-256 checksum for data integrity"""
        json_str = json.dumps(data, sort_keys=True)
        return hashlib.sha256(json_str.encode()).hexdigest()

    @staticmethod
    async def verify_integrity(resource_id: str, resource_type: str) -> bool:
        """Verify data has not been tampered with"""
        record = await db.get_record(resource_type, resource_id)
        current_hash = record.content_hash
        calculated_hash = await calculate_checksum(record.data)

        if current_hash != calculated_hash:
            await audit_log(
                action="INTEGRITY_VIOLATION_DETECTED",
                resource_type=resource_type,
                resource_id=resource_id,
                severity="CRITICAL"
            )
            return False
        return True
```

**Tasks:**
- [ ] Add checksum calculation to all critical data
- [ ] Implement integrity verification endpoints
- [ ] Create automated integrity checks (daily)
- [ ] Add integrity violation alerts
- [ ] Document integrity verification procedures

### 3.4 System Validation Documentation

**Documents to Create:**
1. **Installation Qualification (IQ)**
   - Hardware specifications
   - Software installation procedures
   - Configuration verification
   - Network setup validation

2. **Operational Qualification (OQ)**
   - Functional testing results
   - Performance benchmarks
   - Security testing results
   - Disaster recovery testing

3. **Performance Qualification (PQ)**
   - User acceptance testing
   - Real-world scenario testing
   - Load testing results
   - Compliance verification

**Tasks:**
- [ ] Create IQ documentation template
- [ ] Create OQ documentation template
- [ ] Create PQ documentation template
- [ ] Execute validation protocols
- [ ] Generate validation reports

---

## PHASE 4: CDISC COMPLIANCE ENHANCEMENT (Weeks 11-16)

### Objective
Transform from descriptive rules to executable validation engine with full CDISC compliance.

### 4.1 Executable Rule Engine

**Current State:** Markdown files read by LLMs (descriptive)
**Target State:** Python-based executable rule engine (prescriptive)

**Implementation:**
```python
from abc import ABC, abstractmethod
from typing import Any, Dict, List
from enum import Enum

class RuleSeverity(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"

class RuleResult:
    def __init__(
        self,
        rule_id: str,
        passed: bool,
        severity: RuleSeverity,
        message: str,
        details: Dict[str, Any] = None
    ):
        self.rule_id = rule_id
        self.passed = passed
        self.severity = severity
        self.message = message
        self.details = details or {}

class ADAMRule(ABC):
    def __init__(self, rule_id: str, name: str, description: str):
        self.rule_id = rule_id
        self.name = name
        self.description = description

    @abstractmethod
    def validate(self, variable: Dict, code: str, context: Dict) -> RuleResult:
        """Execute the rule validation"""
        pass

class DateVariableNamingRule(ADAMRule):
    """Variables ending in DT must be date type"""

    def __init__(self):
        super().__init__(
            rule_id="ADAM-VAR-001",
            name="Date Variable Naming Convention",
            description="Variables with suffix 'DT' must be date type and use proper date parsing"
        )

    def validate(self, variable: Dict, code: str, context: Dict) -> RuleResult:
        var_name = variable.get("name", "")
        var_type = variable.get("type", "")

        if var_name.endswith("DT"):
            # Check type
            if var_type.lower() not in ["date", "num"]:
                return RuleResult(
                    rule_id=self.rule_id,
                    passed=False,
                    severity=RuleSeverity.ERROR,
                    message=f"Variable {var_name} ends with 'DT' but type is '{var_type}', should be 'Date'",
                    details={"variable": var_name, "type": var_type}
                )

            # Check code for proper date parsing
            date_functions = ["as.Date", "ymd", "mdy", "dmy", "as_date", "INPUT(", "DATEPART("]
            has_date_parsing = any(func in code for func in date_functions)

            if not has_date_parsing:
                return RuleResult(
                    rule_id=self.rule_id,
                    passed=False,
                    severity=RuleSeverity.WARNING,
                    message=f"Variable {var_name} should use date parsing function",
                    details={
                        "variable": var_name,
                        "suggestion": "Use as.Date(), ymd(), or INPUT() for date conversion"
                    }
                )

        return RuleResult(
            rule_id=self.rule_id,
            passed=True,
            severity=RuleSeverity.INFO,
            message=f"Date naming convention validated for {var_name}"
        )

class TreatmentVariableRule(ADAMRule):
    """Validate treatment variable naming patterns"""

    def validate(self, variable: Dict, code: str, context: Dict) -> RuleResult:
        var_name = variable.get("name", "")

        # TRTxxP pattern (Planned treatment)
        if re.match(r"TRT\d{2}P$", var_name):
            if "EXSTDTC" not in code and "EX" not in context.get("source_datasets", []):
                return RuleResult(
                    rule_id="ADAM-VAR-002",
                    passed=False,
                    severity=RuleSeverity.ERROR,
                    message=f"{var_name} should derive from EX domain (EXSTDTC)",
                    details={"variable": var_name, "expected_source": "EX"}
                )

        return RuleResult(
            rule_id="ADAM-VAR-002",
            passed=True,
            severity=RuleSeverity.INFO,
            message="Treatment variable validated"
        )

class RuleEngine:
    def __init__(self):
        self.rules: List[ADAMRule] = []
        self._register_default_rules()

    def _register_default_rules(self):
        """Register all built-in ADAM rules"""
        self.rules.extend([
            DateVariableNamingRule(),
            TreatmentVariableRule(),
            # ... add all other rules
        ])

    def register_rule(self, rule: ADAMRule):
        """Register custom rule"""
        self.rules.append(rule)

    async def validate_code(
        self,
        variable: Dict,
        code: str,
        context: Dict = None
    ) -> List[RuleResult]:
        """Execute all applicable rules"""
        results = []
        context = context or {}

        for rule in self.rules:
            try:
                result = rule.validate(variable, code, context)
                results.append(result)
            except Exception as e:
                logger.error(f"Rule {rule.rule_id} failed: {e}")
                results.append(RuleResult(
                    rule_id=rule.rule_id,
                    passed=False,
                    severity=RuleSeverity.ERROR,
                    message=f"Rule execution failed: {str(e)}"
                ))

        return results

    def get_validation_summary(self, results: List[RuleResult]) -> Dict:
        """Generate validation summary"""
        return {
            "total_rules": len(results),
            "passed": sum(1 for r in results if r.passed),
            "failed": sum(1 for r in results if not r.passed),
            "errors": sum(1 for r in results if r.severity == RuleSeverity.ERROR and not r.passed),
            "warnings": sum(1 for r in results if r.severity == RuleSeverity.WARNING and not r.passed),
            "results": [r.__dict__ for r in results]
        }
```

**Tasks:**
- [ ] Create rule base class and framework
- [ ] Implement all ADAM IG rules as executable code
- [ ] Add rule configuration management
- [ ] Create rule testing framework
- [ ] Integrate with code generation pipeline
- [ ] Add custom rule support for organizations

### 4.2 CDISC Controlled Terminology Integration

**Implementation:**
```python
import requests
from typing import Optional, List

class CDISCLibraryClient:
    """
    Client for CDISC Library API
    https://www.cdisc.org/cdisc-library
    """

    BASE_URL = "https://library.cdisc.org/api"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "api-key": api_key,
            "Accept": "application/json"
        }

    async def get_controlled_terminology(
        self,
        codelist: str,
        version: str = "2023-12-15"
    ) -> List[Dict]:
        """Fetch controlled terminology for a codelist"""
        url = f"{self.BASE_URL}/mdr/ct/packages/{version}/codelists/{codelist}/terms"

        response = requests.get(url, headers=self.headers)
        response.raise_for_status()

        return response.json().get("terms", [])

    async def validate_term(
        self,
        codelist: str,
        term_value: str,
        version: str = "2023-12-15"
    ) -> bool:
        """Validate if a term is valid for a codelist"""
        terms = await self.get_controlled_terminology(codelist, version)
        valid_values = [t.get("submissionValue") for t in terms]

        return term_value in valid_values

    async def get_adam_ig_rules(self, version: str = "1.3") -> Dict:
        """Fetch ADAM IG implementation guide rules"""
        url = f"{self.BASE_URL}/mdr/adam/{version}"
        response = requests.get(url, headers=self.headers)
        return response.json()

class ControlledTerminologyValidator:
    def __init__(self):
        self.client = CDISCLibraryClient(settings.CDISC_API_KEY)
        self.cache = {}  # In-memory cache

    async def validate_sex(self, value: str) -> RuleResult:
        """Validate SEX variable against controlled terminology"""
        valid_values = ["M", "F", "U", "UNDIFFERENTIATED"]

        if value not in valid_values:
            return RuleResult(
                rule_id="CT-001",
                passed=False,
                severity=RuleSeverity.ERROR,
                message=f"Invalid SEX value '{value}'. Must be one of: {', '.join(valid_values)}",
                details={
                    "variable": "SEX",
                    "invalid_value": value,
                    "valid_values": valid_values,
                    "reference": "CDISC CT SEX codelist"
                }
            )

        return RuleResult(
            rule_id="CT-001",
            passed=True,
            severity=RuleSeverity.INFO,
            message=f"SEX value '{value}' is valid"
        )

    async def validate_race(self, value: str) -> RuleResult:
        """Validate RACE variable"""
        valid_values = [
            "AMERICAN INDIAN OR ALASKA NATIVE",
            "ASIAN",
            "BLACK OR AFRICAN AMERICAN",
            "NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER",
            "WHITE",
            "MULTIPLE",
            "NOT REPORTED",
            "UNKNOWN"
        ]

        if value not in valid_values:
            return RuleResult(
                rule_id="CT-002",
                passed=False,
                severity=RuleSeverity.ERROR,
                message=f"Invalid RACE value",
                details={
                    "invalid_value": value,
                    "valid_values": valid_values
                }
            )

        return RuleResult(rule_id="CT-002", passed=True, severity=RuleSeverity.INFO, message="Valid RACE value")
```

**Tasks:**
- [ ] Obtain CDISC Library API access
- [ ] Implement CDISC Library client
- [ ] Create controlled terminology database cache
- [ ] Add automatic CT validation to code generation
- [ ] Implement CT version management
- [ ] Add MedDRA dictionary integration (optional)

### 4.3 Cross-Variable Consistency Validation

**Implementation:**
```python
class CrossVariableValidator:
    """
    Validate consistency across multiple generated code snippets
    """

    async def validate_date_consistency(self, snippets: List[CodeSnippet]) -> List[RuleResult]:
        """Ensure date variables use consistent parsing"""
        results = []
        date_vars = {}

        for snippet in snippets:
            if snippet.variable_name.endswith("DT"):
                # Extract date parsing function used
                parsing_func = self._extract_date_function(snippet.code)
                date_vars[snippet.variable_name] = parsing_func

        # Check for inconsistencies
        unique_functions = set(date_vars.values())
        if len(unique_functions) > 1:
            results.append(RuleResult(
                rule_id="CROSS-001",
                passed=False,
                severity=RuleSeverity.WARNING,
                message="Inconsistent date parsing functions across variables",
                details={
                    "variables": date_vars,
                    "suggestion": "Use consistent date parsing (e.g., always use ymd())"
                }
            ))

        return results

    async def validate_treatment_derivation(self, snippets: List[CodeSnippet]) -> List[RuleResult]:
        """Ensure treatment variables are derived consistently"""
        treatment_vars = [s for s in snippets if re.match(r"TRT\d{2}[PA]", s.variable_name)]

        source_datasets = {}
        for snippet in treatment_vars:
            # Extract source dataset
            sources = self._extract_source_datasets(snippet.code)
            source_datasets[snippet.variable_name] = sources

        # All treatment variables should come from EX domain
        results = []
        for var_name, sources in source_datasets.items():
            if "EX" not in sources:
                results.append(RuleResult(
                    rule_id="CROSS-002",
                    passed=False,
                    severity=RuleSeverity.ERROR,
                    message=f"Treatment variable {var_name} does not derive from EX domain",
                    details={"variable": var_name, "sources": sources}
                ))

        return results

    async def validate_all_snippets(self, snippets: List[CodeSnippet]) -> Dict:
        """Run all cross-variable validations"""
        all_results = []

        all_results.extend(await self.validate_date_consistency(snippets))
        all_results.extend(await self.validate_treatment_derivation(snippets))
        # Add more cross-validations...

        return {
            "total_checks": len(all_results),
            "passed": sum(1 for r in all_results if r.passed),
            "failed": sum(1 for r in all_results if not r.passed),
            "results": all_results
        }
```

**Tasks:**
- [ ] Implement cross-variable validator
- [ ] Add consistency checks for common patterns
- [ ] Integrate with program generation
- [ ] Create validation reports
- [ ] Add automated fixing suggestions

### 4.4 Define-XML Generation

**Implementation:**
```python
from lxml import etree
from lxml.builder import E

class DefineXMLGenerator:
    """
    Generate Define-XML v2.1 compliant metadata
    """

    def __init__(self, study_id: str, protocol: str):
        self.study_id = study_id
        self.protocol = protocol

    def generate(self, dataset_metadata: Dict) -> str:
        """Generate Define-XML for ADAM datasets"""

        # Define-XML root element
        root = E.ODM(
            {
                "xmlns": "http://www.cdisc.org/ns/odm/v1.3",
                "xmlns:xlink": "http://www.w3.org/1999/xlink",
                "xmlns:def": "http://www.cdisc.org/ns/def/v2.1",
                "ODMVersion": "1.3.2",
                "FileOID": f"Define-XML_{self.study_id}",
                "FileType": "Snapshot",
                "CreationDateTime": datetime.utcnow().isoformat()
            }
        )

        # Study element
        study = E.Study(OID=f"Study.{self.study_id}")
        root.append(study)

        # Global Variables
        global_vars = E.GlobalVariables(
            E.StudyName(self.study_id),
            E.StudyDescription(dataset_metadata.get("description", "")),
            E.ProtocolName(self.protocol)
        )
        study.append(global_vars)

        # MetaDataVersion
        metadata_version = E.MetaDataVersion(
            {
                "OID": f"MDV.{self.study_id}",
                "Name": "ADAM Metadata",
                "{http://www.cdisc.org/ns/def/v2.1}DefineVersion": "2.1",
                "{http://www.cdisc.org/ns/def/v2.1}StandardName": "ADAM-IG",
                "{http://www.cdisc.org/ns/def/v2.1}StandardVersion": "1.3"
            }
        )
        study.append(metadata_version)

        # Add ItemGroupDef for each dataset
        for dataset in dataset_metadata.get("datasets", []):
            item_group = self._create_item_group(dataset)
            metadata_version.append(item_group)

        # Generate XML string
        xml_str = etree.tostring(
            root,
            pretty_print=True,
            xml_declaration=True,
            encoding="UTF-8"
        ).decode()

        return xml_str

    def _create_item_group(self, dataset: Dict) -> etree.Element:
        """Create ItemGroupDef for a dataset"""
        item_group = E.ItemGroupDef(
            {
                "OID": f"IG.{dataset['name']}",
                "Name": dataset["name"],
                "Repeating": "No" if dataset["name"] == "ADSL" else "Yes",
                "{http://www.cdisc.org/ns/def/v2.1}Class": "ADAM",
                "{http://www.cdisc.org/ns/def/v2.1}Structure": "One record per subject" if dataset["name"] == "ADSL" else "One record per subject per analysis"
            }
        )

        # Add Description
        description = E.Description(
            E.TranslatedText(dataset.get("label", ""), {"xml:lang": "en"})
        )
        item_group.append(description)

        # Add ItemRef for each variable
        for idx, variable in enumerate(dataset.get("variables", []), 1):
            item_ref = E.ItemRef(
                {
                    "ItemOID": f"IT.{dataset['name']}.{variable['name']}",
                    "OrderNumber": str(idx),
                    "Mandatory": "Yes" if variable.get("required") else "No"
                }
            )
            item_group.append(item_ref)

        return item_group

    def validate_define_xml(self, xml_content: str) -> Dict:
        """Validate Define-XML against schema"""
        # Load Define-XML 2.1 schema
        schema_path = "schemas/define-xml-2.1.xsd"
        xmlschema_doc = etree.parse(schema_path)
        xmlschema = etree.XMLSchema(xmlschema_doc)

        # Parse and validate
        xml_doc = etree.fromstring(xml_content.encode())
        is_valid = xmlschema.validate(xml_doc)

        if not is_valid:
            errors = xmlschema.error_log
            return {
                "valid": False,
                "errors": [str(e) for e in errors]
            }

        return {"valid": True, "errors": []}
```

**Tasks:**
- [ ] Implement Define-XML v2.1 generator
- [ ] Add Define-XML validation against XSD schema
- [ ] Create computational method documentation
- [ ] Add value-level metadata
- [ ] Implement Define-XML export endpoint
- [ ] Add Define-XML preview in UI

---

## PHASE 5: TESTING & QUALITY ASSURANCE (Weeks 17-22)

### Objective
Achieve 80%+ test coverage and implement comprehensive testing infrastructure.

### 5.1 Backend Testing Strategy

**Test Pyramid:**
- Unit Tests: 60%
- Integration Tests: 30%
- E2E Tests: 10%

**Implementation:**
```python
# pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
markers =
    unit: Unit tests
    integration: Integration tests
    e2e: End-to-end tests
    security: Security tests
    performance: Performance tests
    regulatory: 21 CFR Part 11 compliance tests

# conftest.py
import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.db import Base

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
async def db_session():
    """Create test database session"""
    engine = create_async_engine("postgresql+asyncpg://test:test@localhost/adam_test")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def test_user(db_session):
    """Create test user"""
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("TestPassword123!"),
        role="user"
    )
    db_session.add(user)
    await db_session.commit()
    return user

@pytest.fixture
async def auth_headers(test_user):
    """Get authentication headers"""
    token = create_access_token({"sub": test_user.username, "role": test_user.role})
    return {"Authorization": f"Bearer {token}"}
```

**Example Tests:**
```python
# tests/test_authentication.py
import pytest
from httpx import AsyncClient

@pytest.mark.unit
async def test_password_hashing():
    """Test password hashing"""
    password = "SecurePassword123!"
    hashed = get_password_hash(password)

    assert verify_password(password, hashed)
    assert not verify_password("wrong", hashed)

@pytest.mark.integration
async def test_login_success(client: AsyncClient):
    """Test successful login"""
    response = await client.post("/api/auth/login", data={
        "username": "testuser",
        "password": "TestPassword123!"
    })

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.security
async def test_login_rate_limiting(client: AsyncClient):
    """Test rate limiting on login endpoint"""
    for i in range(10):
        response = await client.post("/api/auth/login", data={
            "username": "testuser",
            "password": "wrong"
        })

    # 11th attempt should be rate limited
    response = await client.post("/api/auth/login", data={
        "username": "testuser",
        "password": "wrong"
    })

    assert response.status_code == 429

@pytest.mark.regulatory
async def test_audit_trail_immutability(db_session):
    """Test that audit trail cannot be modified"""
    audit_entry = await db_session.execute(
        "INSERT INTO audit_trail (user_id, action, success) VALUES (...) RETURNING *"
    )

    # Attempt to update should fail
    with pytest.raises(Exception, match="cannot be modified"):
        await db_session.execute(
            "UPDATE audit_trail SET action = 'modified' WHERE audit_id = ..."
        )

    # Attempt to delete should fail
    with pytest.raises(Exception, match="cannot be modified"):
        await db_session.execute(
            "DELETE FROM audit_trail WHERE audit_id = ..."
        )

# tests/test_code_generation.py
@pytest.mark.integration
async def test_code_generation_with_validation(client: AsyncClient, auth_headers):
    """Test code generation includes validation"""
    response = await client.post(
        "/api/v1/code-generation/generate",
        json={
            "variables": [
                {
                    "name": "AGEGR1",
                    "label": "Age Group 1",
                    "type": "Char",
                    "algorithm": "IF AGE < 18 THEN 'Child' ELSE 'Adult'"
                }
            ],
            "language": "R"
        },
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()

    assert "code" in data
    assert "validation_results" in data
    assert data["validation_results"]["total_rules"] > 0

# tests/test_cdisc_validation.py
@pytest.mark.unit
async def test_date_variable_naming_rule():
    """Test ADAM date variable naming rule"""
    rule = DateVariableNamingRule()

    # Valid case
    result = rule.validate(
        variable={"name": "TRTSDT", "type": "Date"},
        code="TRTSDT <- as.Date(EX$EXSTDTC)",
        context={}
    )
    assert result.passed is True

    # Invalid type
    result = rule.validate(
        variable={"name": "TRTSDT", "type": "Char"},
        code="TRTSDT <- EX$EXSTDTC",
        context={}
    )
    assert result.passed is False
    assert result.severity == RuleSeverity.ERROR

# tests/test_electronic_signature.py
@pytest.mark.regulatory
async def test_electronic_signature_creation(db_session, test_user):
    """Test e-signature creation"""
    signature = await ElectronicSignature.sign_document(
        user_id=test_user.user_id,
        document_hash="abc123",
        reason="Approval of code snippet for AGEGR1",
        password="TestPassword123!"
    )

    assert signature.signature_id is not None
    assert signature.signature_hash is not None
    assert signature.is_valid is True

    # Verify signature is in audit trail
    audit_entry = await db_session.query(AuditTrail).filter_by(
        action="ELECTRONIC_SIGNATURE_CREATED",
        resource_id=signature.signature_id
    ).first()

    assert audit_entry is not None
```

**Tasks:**
- [ ] Set up pytest with async support
- [ ] Create test fixtures and factories
- [ ] Write unit tests for all modules (target: 80% coverage)
- [ ] Write integration tests for API endpoints
- [ ] Write security tests for authentication/authorization
- [ ] Write regulatory compliance tests
- [ ] Set up test database
- [ ] Configure test coverage reporting

### 5.2 Frontend Testing Strategy

**Technology Stack:**
- **Unit Testing:** Vitest + React Testing Library
- **E2E Testing:** Playwright
- **Component Testing:** Storybook

**Tasks:**
- [ ] Install Vitest and React Testing Library
- [ ] Create test utilities and helpers
- [ ] Write component unit tests
- [ ] Write integration tests for user flows
- [ ] Set up Playwright for E2E tests
- [ ] Configure Storybook for component development
- [ ] Add visual regression testing

### 5.3 CI/CD Pipeline

**GitHub Actions Workflow:**
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install flake8 black mypy
          cd backend && pip install -r requirements.txt

      - name: Lint with flake8
        run: flake8 backend/app --max-line-length=100

      - name: Check formatting with black
        run: black --check backend/app

      - name: Type check with mypy
        run: mypy backend/app

      - name: Frontend lint
        run: |
          cd frontend
          npm ci
          npm run lint

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: adam_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt

      - name: Run tests with coverage
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost/adam_test
        run: |
          cd backend
          pytest --cov=app --cov-report=xml --cov-report=html

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./backend/coverage.xml

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd frontend
          npm ci

      - name: Run tests
        run: |
          cd frontend
          npm test -- --coverage

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Bandit security scan
        run: |
          pip install bandit
          bandit -r backend/app -f json -o bandit-report.json

      - name: Run npm audit
        run: |
          cd frontend
          npm audit --audit-level=moderate

  build-and-deploy:
    needs: [lint, test-backend, test-frontend, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Build Docker images
        run: |
          docker build -t adamai-backend:${{ github.sha }} -f backend/Dockerfile .
          docker build -t adamai-frontend:${{ github.sha }} -f frontend/Dockerfile .

      - name: Push to container registry
        run: |
          # Push to Azure Container Registry or AWS ECR

      - name: Deploy to staging
        run: |
          # Kubernetes deployment or Azure App Service
```

**Tasks:**
- [ ] Set up GitHub Actions
- [ ] Configure test database for CI
- [ ] Set up code coverage reporting (Codecov)
- [ ] Add security scanning (Bandit, npm audit)
- [ ] Configure automated deployment
- [ ] Add deployment approval gates
- [ ] Set up staging environment

---

## PHASE 6: OPERATIONAL INFRASTRUCTURE (Weeks 23-28)

### Objective
Build production-ready infrastructure for deployment, monitoring, and operations.

### 6.1 Containerization

**Docker Configuration:**

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app app/

# Create non-root user
RUN useradd -m -u 1000 adamai && chown -R adamai:adamai /app
USER adamai

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

EXPOSE 8000

CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
```

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}
      REDIS_URL: redis://redis:6379
      SECRET_KEY: ${SECRET_KEY}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    ports:
      - "8000:8000"
    volumes:
      - ./backend/logs:/app/logs

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
```

**Tasks:**
- [ ] Create production Dockerfiles
- [ ] Set up multi-stage builds for optimization
- [ ] Configure docker-compose for local development
- [ ] Implement health checks
- [ ] Optimize image sizes
- [ ] Set up container registry

### 6.2 Kubernetes Deployment

**Kubernetes Manifests:**
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: adamai-backend
  namespace: adamai-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: adamai-backend
  template:
    metadata:
      labels:
        app: adamai-backend
    spec:
      containers:
      - name: backend
        image: adamai/backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: adamai-secrets
              key: database-url
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: adamai-secrets
              key: secret-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: adamai-backend-service
  namespace: adamai-prod
spec:
  selector:
    app: adamai-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: LoadBalancer
```

**Tasks:**
- [ ] Create Kubernetes manifests
- [ ] Set up Helm charts
- [ ] Configure auto-scaling (HPA)
- [ ] Implement rolling updates
- [ ] Set up ingress controller
- [ ] Configure SSL/TLS termination

### 6.3 Monitoring & Observability

**Prometheus + Grafana:**
```python
# app/utils/metrics.py
from prometheus_client import Counter, Histogram, Gauge
from fastapi import FastAPI
from prometheus_client import make_asgi_app

# Metrics
code_generation_requests = Counter(
    'code_generation_requests_total',
    'Total code generation requests',
    ['provider', 'language', 'status']
)

code_generation_duration = Histogram(
    'code_generation_duration_seconds',
    'Code generation duration',
    ['provider', 'language']
)

active_users = Gauge(
    'active_users',
    'Number of active users'
)

llm_api_calls = Counter(
    'llm_api_calls_total',
    'Total LLM API calls',
    ['provider', 'model', 'status']
)

# Add metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
```

**Grafana Dashboard Configuration:**
- API response times
- Request rates (per endpoint)
- Error rates
- Database query performance
- LLM API usage and costs
- Active users
- Resource utilization (CPU, memory)

**Tasks:**
- [ ] Set up Prometheus
- [ ] Configure Grafana dashboards
- [ ] Add custom metrics
- [ ] Set up alerting rules
- [ ] Configure alert notifications (Slack, email)
- [ ] Implement distributed tracing (Jaeger)

### 6.4 Logging Infrastructure

**ELK Stack (Elasticsearch + Logstash + Kibana):**
```python
# app/utils/logging_config.py
import logging
from pythonjsonlogger import jsonlogger

class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record['timestamp'] = record.created
        log_record['level'] = record.levelname
        log_record['user_id'] = getattr(record, 'user_id', None)
        log_record['request_id'] = getattr(record, 'request_id', None)

logger = logging.getLogger()
handler = logging.StreamHandler()
formatter = CustomJsonFormatter('%(timestamp)s %(level)s %(name)s %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)
```

**Tasks:**
- [ ] Set up Elasticsearch cluster
- [ ] Configure Logstash pipelines
- [ ] Create Kibana dashboards
- [ ] Implement structured logging
- [ ] Set up log retention policies
- [ ] Configure log-based alerts

### 6.5 Backup & Disaster Recovery

**Backup Strategy:**
```bash
#!/bin/bash
# backup-database.sh

# Environment variables
BACKUP_DIR="/backups/postgresql"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/adamai_${TIMESTAMP}.sql.gz"

# Create backup
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | gzip > $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE s3://adamai-backups/db/

# Retain only last 30 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Verify backup integrity
gunzip -c $BACKUP_FILE | psql -h localhost -U test test_restore
```

**Disaster Recovery Plan:**
1. **Recovery Time Objective (RTO):** < 4 hours
2. **Recovery Point Objective (RPO):** < 1 hour
3. **Backup Frequency:**
   - Full backup: Daily
   - Incremental: Every 6 hours
   - Transaction logs: Continuous
4. **Off-site Replication:** AWS S3 + Azure Blob Storage

**Tasks:**
- [ ] Set up automated daily backups
- [ ] Implement point-in-time recovery
- [ ] Configure off-site backup storage
- [ ] Test backup restoration procedures
- [ ] Document disaster recovery procedures
- [ ] Create runbooks for common issues

---

## PHASE 7: PRODUCTION DEPLOYMENT (Weeks 29-32)

### Objective
Deploy to production with full FDA compliance validation.

### 7.1 Production Checklist

**Security:**
- [ ] All secrets in Azure Key Vault / AWS Secrets Manager
- [ ] SSL/TLS certificates installed
- [ ] HTTPS enforced
- [ ] MFA enabled for all users
- [ ] Rate limiting configured
- [ ] IP whitelisting for admin access
- [ ] Security headers configured (HSTS, CSP, X-Frame-Options)
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified
- [ ] CSRF protection enabled

**Database:**
- [ ] PostgreSQL production cluster set up
- [ ] Connection pooling configured
- [ ] Database backups automated
- [ ] Replication configured
- [ ] Audit trail hash chain validated
- [ ] Immutability constraints verified

**Monitoring:**
- [ ] Prometheus collecting metrics
- [ ] Grafana dashboards created
- [ ] Alerts configured
- [ ] On-call rotation established
- [ ] Incident response procedures documented

**Compliance:**
- [ ] 21 CFR Part 11 validation complete
- [ ] IQ/OQ/PQ documentation complete
- [ ] SOPs documented
- [ ] User training materials created
- [ ] Audit trail tested
- [ ] E-signature functionality validated

**Performance:**
- [ ] Load testing completed (target: 100 concurrent users)
- [ ] Response time < 2s for 95th percentile
- [ ] Database queries optimized
- [ ] Caching strategy implemented
- [ ] CDN configured for static assets

### 7.2 Validation Testing

**Test Scenarios:**
1. **User Authentication Flow**
   - Login with valid credentials
   - Login with invalid credentials (rate limiting)
   - MFA setup and verification
   - Password reset
   - Session timeout
   - Concurrent sessions

2. **Code Generation Workflow**
   - Upload specification
   - Parse specification
   - Generate code for multiple variables
   - Review and approve code
   - E-signature capture
   - Audit trail verification

3. **Compliance Validation**
   - Audit trail immutability
   - E-signature verification
   - Data integrity checksums
   - Access control enforcement
   - Controlled terminology validation

4. **Performance Testing**
   - 100 concurrent users generating code
   - Bulk code generation (50+ variables)
   - Database query performance
   - LLM API resilience

### 7.3 Go-Live Plan

**Week 29: Staging Deployment**
- Deploy to staging environment
- Run full regression tests
- Perform UAT with pilot users
- Load testing
- Security penetration testing

**Week 30: Production Deployment**
- Final security review
- Deploy to production
- Smoke tests
- Monitor metrics
- Gradual user rollout (10% → 50% → 100%)

**Week 31: Post-Launch Monitoring**
- 24/7 monitoring
- Incident response ready
- User feedback collection
- Performance optimization

**Week 32: Validation & Documentation**
- Complete validation reports
- Regulatory documentation finalized
- User training completed
- Knowledge base articles published

---

## ARCHITECTURE DECISIONS

### Technology Stack Rationale

**Backend:**
- **Python 3.11+:** Modern, async-capable, excellent data science ecosystem
- **FastAPI:** High performance, automatic OpenAPI docs, async support
- **PostgreSQL 15:** ACID compliance, JSONB support, excellent for regulatory data
- **SQLAlchemy 2.0:** Async ORM, mature, well-documented
- **Alembic:** Industry-standard database migrations

**Frontend:**
- **React 18:** Component-based, large ecosystem, excellent TypeScript support
- **TypeScript:** Type safety, better developer experience
- **Ant Design:** Enterprise-grade UI components, WCAG compliant
- **Zustand:** Lightweight state management
- **React Query:** Excellent for API data fetching and caching

**Infrastructure:**
- **Docker:** Containerization standard
- **Kubernetes:** Production-grade orchestration, auto-scaling
- **PostgreSQL:** Regulatory-compliant database
- **Redis:** Caching, session storage
- **Nginx:** Reverse proxy, load balancing

**Monitoring:**
- **Prometheus:** Metrics collection
- **Grafana:** Visualization
- **ELK Stack:** Log aggregation and analysis
- **Jaeger:** Distributed tracing

---

## RISK ASSESSMENT & MITIGATION

### Critical Risks

**1. Regulatory Rejection (High Impact)**
- **Risk:** FDA rejects due to compliance gaps
- **Mitigation:**
  - Engage regulatory consultant early
  - Conduct compliance audit before submission
  - Implement all 21 CFR Part 11 requirements
  - Complete IQ/OQ/PQ documentation

**2. Data Loss (Critical Impact)**
- **Risk:** Database failure leads to data loss
- **Mitigation:**
  - Automated hourly backups
  - Off-site replication
  - Regular restore testing
  - Point-in-time recovery capability

**3. Security Breach (Critical Impact)**
- **Risk:** Unauthorized access to clinical data
- **Mitigation:**
  - Multi-layer security (authentication, authorization, encryption)
  - Regular security audits
  - Penetration testing
  - Security monitoring and alerts
  - Incident response plan

**4. Performance Issues (Medium Impact)**
- **Risk:** System cannot handle production load
- **Mitigation:**
  - Load testing before launch
  - Auto-scaling infrastructure
  - Performance monitoring
  - Caching strategy
  - Database query optimization

**5. LLM Provider Outages (Medium Impact)**
- **Risk:** LLM provider goes down, code generation stops
- **Mitigation:**
  - Multi-provider support
  - Automatic failover
  - Caching of common patterns
  - Rate limit management
  - Provider health monitoring

---

## SUCCESS METRICS

### Technical Metrics
- **Uptime:** 99.9% availability
- **Response Time:** < 2s for 95th percentile
- **Test Coverage:** > 80% for backend, > 70% for frontend
- **Security:** Zero critical vulnerabilities
- **Audit Trail:** 100% of actions logged

### Compliance Metrics
- **21 CFR Part 11:** 100% compliance
- **CDISC Standards:** 100% ADAM IG v2.1 compliance
- **Validation:** IQ/OQ/PQ complete and approved

### Business Metrics
- **User Adoption:** 80% of pilot users actively using
- **Code Generation Accuracy:** > 95% approval rate
- **Time Savings:** 70% reduction in manual ADAM coding time
- **User Satisfaction:** > 4.5/5 stars

---

## TIMELINE SUMMARY

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Security | 2 weeks | Secrets management, MFA, endpoint auth |
| Phase 2: Database | 3 weeks | PostgreSQL schema, migrations, persistence |
| Phase 3: Compliance | 5 weeks | E-signatures, audit trails, IQ/OQ/PQ |
| Phase 4: CDISC | 6 weeks | Rule engine, CT integration, Define-XML |
| Phase 5: Testing | 6 weeks | 80% coverage, CI/CD, E2E tests |
| Phase 6: Infrastructure | 6 weeks | Docker, K8s, monitoring, backups |
| Phase 7: Deployment | 4 weeks | Staging, production, validation |
| **Total** | **32 weeks (8 months)** | Production-ready, FDA-compliant SaaS |

**Note:** This is an accelerated timeline. The original criticism.md suggested 12-18 months for full production readiness including all regulatory validation.

---

## NEXT STEPS

### Immediate Actions (This Week)
1. Set up development database (PostgreSQL)
2. Implement secure secrets management
3. Add authentication to all endpoints
4. Start database schema design
5. Set up basic CI/CD pipeline

### Short-term (Next 2 Weeks)
1. Complete Phase 1 (Security)
2. Begin Phase 2 (Database implementation)
3. Engage regulatory consultant
4. Start IQ/OQ/PQ documentation templates

### Medium-term (Next Month)
1. Complete database implementation
2. Begin 21 CFR Part 11 implementation
3. Set up testing infrastructure
4. Design executable rule engine

---

**Document Owner:** Technical Architecture Team
**Reviewers Required:** Security, Regulatory Affairs, QA, DevOps
**Next Review Date:** Weekly during implementation
**Status:** APPROVED FOR IMPLEMENTATION
