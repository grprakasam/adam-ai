"""
Security Schemas for SDTM Test Data Generation

Implements input validation to prevent security vulnerabilities:
- SQL injection
- Path traversal
- XSS attacks
- Invalid characters
"""

from pydantic import BaseModel, validator, Field
from typing import Optional, List
import re
from datetime import datetime


class SecureStudyIdentifier(BaseModel):
    """Secure study ID validation to prevent path traversal and injection attacks"""

    study_id: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Study identifier (alphanumeric, hyphens, underscores only)"
    )

    @validator('study_id')
    def validate_study_id(cls, v):
        """
        Validate study_id to prevent security issues:
        - Path traversal (../)
        - Special characters
        - SQL injection attempts
        """
        if not v:
            raise ValueError("study_id cannot be empty")

        # Check for path traversal attempts
        if '..' in v:
            raise ValueError("Path traversal detected: '..' not allowed in study_id")

        if '/' in v or '\\' in v:
            raise ValueError("Path separators not allowed in study_id")

        # Only allow alphanumeric, hyphens, and underscores
        if not re.match(r'^[A-Z0-9_-]+$', v, re.IGNORECASE):
            raise ValueError(
                "study_id must contain only letters, numbers, hyphens, and underscores"
            )

        # Check for SQL injection patterns
        sql_keywords = ['SELECT', 'DROP', 'DELETE', 'INSERT', 'UPDATE', 'UNION', '--', ';']
        v_upper = v.upper()
        for keyword in sql_keywords:
            if keyword in v_upper:
                raise ValueError(f"Suspicious pattern detected: {keyword}")

        return v


class SecureDomainCode(BaseModel):
    """Secure domain code validation"""

    domain: str = Field(
        ...,
        min_length=2,
        max_length=8,
        description="SDTM domain code (2-8 uppercase letters)"
    )

    @validator('domain')
    def validate_domain(cls, v):
        """Validate domain code"""
        if not v:
            raise ValueError("domain cannot be empty")

        # Convert to uppercase
        v = v.upper()

        # Only allow uppercase letters
        if not re.match(r'^[A-Z]{2,8}$', v):
            raise ValueError(
                "domain must be 2-8 uppercase letters (e.g., DM, AE, LB)"
            )

        # Whitelist of known SDTM domains
        KNOWN_DOMAINS = [
            'DM', 'AE', 'LB', 'VS', 'EX', 'DS', 'MH', 'CM', 'PR', 'SU',
            'EG', 'PE', 'QS', 'SC', 'DA', 'DD', 'DV', 'CE', 'FA', 'SR',
            'SUPPAE', 'SUPPDM', 'SUPPDS', 'SUPPCM'
        ]

        if v not in KNOWN_DOMAINS:
            raise ValueError(
                f"Unknown domain: {v}. Supported domains: {', '.join(KNOWN_DOMAINS[:10])}..."
            )

        return v


class SecureDateRange(BaseModel):
    """Secure date validation"""

    start_date: str = Field(..., description="Start date in YYYY-MM-DD format")
    end_date: str = Field(..., description="End date in YYYY-MM-DD format")

    @validator('start_date', 'end_date')
    def validate_date_format(cls, v):
        """Validate ISO 8601 date format"""
        if not v:
            raise ValueError("Date cannot be empty")

        # Check format YYYY-MM-DD
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', v):
            raise ValueError(
                f"Invalid date format: {v}. Expected YYYY-MM-DD"
            )

        # Validate actual date
        try:
            date_obj = datetime.strptime(v, '%Y-%m-%d')
        except ValueError as e:
            raise ValueError(f"Invalid date: {v}. {str(e)}")

        # Check reasonable range (1900-2100)
        if date_obj.year < 1900 or date_obj.year > 2100:
            raise ValueError(
                f"Date out of reasonable range: {v}. Year must be between 1900-2100"
            )

        return v

    @validator('end_date')
    def validate_end_after_start(cls, v, values):
        """Validate end_date is after start_date"""
        if 'start_date' in values:
            start = datetime.strptime(values['start_date'], '%Y-%m-%d')
            end = datetime.strptime(v, '%Y-%m-%d')

            if end <= start:
                raise ValueError(
                    f"end_date ({v}) must be after start_date ({values['start_date']})"
                )

            # Check not more than 10 years
            days_diff = (end - start).days
            if days_diff > 3650:  # ~10 years
                raise ValueError(
                    f"Date range too large: {days_diff} days. Maximum: 3650 days (10 years)"
                )

        return v


class SecureNumericRange(BaseModel):
    """Secure numeric range validation"""

    value: int = Field(..., description="Numeric value")
    min_value: int = Field(default=0, description="Minimum allowed value")
    max_value: int = Field(default=1000000, description="Maximum allowed value")

    @validator('value')
    def validate_value(cls, v, values):
        """Validate numeric value is within range"""
        min_val = values.get('min_value', 0)
        max_val = values.get('max_value', 1000000)

        if v < min_val:
            raise ValueError(f"Value {v} is below minimum {min_val}")

        if v > max_val:
            raise ValueError(f"Value {v} exceeds maximum {max_val}")

        return v


class SecureFilenameSanitizer:
    """Sanitize filenames to prevent directory traversal and injection"""

    @staticmethod
    def sanitize(filename: str, max_length: int = 255) -> str:
        """
        Sanitize filename to prevent security issues.

        Args:
            filename: Original filename
            max_length: Maximum filename length

        Returns:
            Sanitized filename safe for file system operations
        """
        if not filename:
            raise ValueError("Filename cannot be empty")

        # Remove path separators
        filename = filename.replace('/', '_').replace('\\', '_')

        # Remove parent directory references
        filename = filename.replace('..', '')

        # Remove null bytes
        filename = filename.replace('\x00', '')

        # Only allow alphanumeric, dots, hyphens, underscores
        filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)

        # Remove leading/trailing dots and spaces
        filename = filename.strip('. ')

        # Ensure not empty after sanitization
        if not filename:
            raise ValueError("Filename invalid after sanitization")

        # Truncate to max length
        if len(filename) > max_length:
            # Preserve extension
            name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
            if ext:
                max_name_len = max_length - len(ext) - 1
                filename = name[:max_name_len] + '.' + ext
            else:
                filename = filename[:max_length]

        # Prevent reserved Windows filenames
        RESERVED_NAMES = [
            'CON', 'PRN', 'AUX', 'NUL',
            'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
            'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
        ]
        name_upper = filename.upper().split('.')[0]
        if name_upper in RESERVED_NAMES:
            filename = f"file_{filename}"

        return filename


class SecureParameterValidator:
    """Validate SDTM generation parameters for security and reasonableness"""

    @staticmethod
    def validate_treatment_arms(arms: List[str]) -> List[str]:
        """Validate treatment arm names"""
        if not arms:
            raise ValueError("Treatment arms list cannot be empty")

        if len(arms) > 20:
            raise ValueError(
                f"Too many treatment arms: {len(arms)}. Maximum: 20"
            )

        validated_arms = []
        for arm in arms:
            # Check length
            if len(arm) > 200:
                raise ValueError(
                    f"Treatment arm name too long: {len(arm)} chars. Maximum: 200"
                )

            # Remove potential XSS
            if '<' in arm or '>' in arm or 'script' in arm.lower():
                raise ValueError(
                    f"Invalid characters in treatment arm: {arm}"
                )

            # Remove null bytes
            arm = arm.replace('\x00', '')

            validated_arms.append(arm)

        return validated_arms

    @staticmethod
    def validate_visit_schedule(visit_days: List[int]) -> List[int]:
        """Validate visit schedule days"""
        if not visit_days:
            raise ValueError("Visit schedule cannot be empty")

        if len(visit_days) > 50:
            raise ValueError(
                f"Too many visits: {len(visit_days)}. Maximum: 50"
            )

        # Check each day
        for day in visit_days:
            if not isinstance(day, int):
                raise ValueError(f"Visit day must be integer: {day}")

            if day < -365 or day > 3650:
                raise ValueError(
                    f"Visit day out of range: {day}. Must be between -365 and 3650"
                )

        # Check ascending order
        if visit_days != sorted(visit_days):
            raise ValueError(
                "Visit days must be in ascending order"
            )

        return visit_days


# Example usage in API endpoints
def validate_study_id(study_id: str) -> str:
    """Convenience function to validate study_id"""
    validator = SecureStudyIdentifier(study_id=study_id)
    return validator.study_id


def sanitize_filename(filename: str) -> str:
    """Convenience function to sanitize filenames"""
    return SecureFilenameSanitizer.sanitize(filename)
