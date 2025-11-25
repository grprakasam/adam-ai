"""
Code Review Service Tests

Comprehensive tests for code review session management, variable approval,
and comment functionality.
"""

import pytest
from datetime import datetime
from app.modules.code_review.service import CodeReviewService
from app.modules.code_review.models import (
    VariableApprovalStatus,
    SessionReviewStatus,
    VariableReviewSnapshot,
    CodeReviewComment,
)


class TestCodeReviewSessionCreation:
    """Test code review session creation"""

    def setup_method(self):
        """Initialize service for each test"""
        self.service = CodeReviewService()

    def test_create_session(self):
        """Test creating a new code review session"""
        session = self.service.create_session(
            study_id="STUDY001",
            adam_dataset="ADSL",
            programming_language="R"
        )

        assert session.session_id is not None
        assert session.study_id == "STUDY001"
        assert session.adam_dataset == "ADSL"
        assert session.programming_language == "R"
        assert session.status == SessionReviewStatus.NOT_STARTED
        assert session.total_variables == 0
        assert session.created_at is not None

    def test_get_session(self):
        """Test retrieving a session by ID"""
        created = self.service.create_session("STUDY001", "ADSL", "R")
        retrieved = self.service.get_session(created.session_id)

        assert retrieved is not None
        assert retrieved.session_id == created.session_id
        assert retrieved.study_id == "STUDY001"

    def test_get_nonexistent_session(self):
        """Test retrieving a non-existent session"""
        result = self.service.get_session("nonexistent")
        assert result is None


class TestVariableSnapshots:
    """Test variable snapshot loading and management"""

    def setup_method(self):
        """Initialize service and session for each test"""
        self.service = CodeReviewService()
        self.session = self.service.create_session("STUDY001", "ADSL", "R")
        self.session_id = self.session.session_id

    def test_load_variable_snapshots(self):
        """Test loading variable snapshots from Pair Programming data"""
        snippets_data = {
            "AGEGR1": {
                "variableLabel": "Age Group 1",
                "variableType": "Char",
                "derivation": "Categorize AGE",
                "pseudoCode": "IF AGE < 65 THEN '<65' ELSE ...",
                "pseudoSummary": "Age categorization",
                "codeSnippet": "ADSL$AGEGR1 <- cut(...)",
                "codingRationale": "Categorizes age into groups",
                "userNotes": "Verify edge cases"
            },
            "SAFFL": {
                "variableLabel": "Safety Flag",
                "variableType": "Char",
                "derivation": "Safety population flag",
                "pseudoCode": "IF measurements exist THEN 'Y' ELSE 'N'",
                "pseudoSummary": "Safety flag",
                "codeSnippet": "ADSL$SAFFL <- ifelse(...)",
                "codingRationale": "Determines safety population"
            }
        }

        snapshots = self.service.load_variable_snapshots(self.session_id, snippets_data)

        assert len(snapshots) == 2
        assert snapshots[0].variable_name == "AGEGR1"
        assert snapshots[1].variable_name == "SAFFL"
        assert snapshots[0].approval_status == VariableApprovalStatus.PENDING
        assert snapshots[0].pseudo_code is not None

    def test_get_variable_snapshots(self):
        """Test retrieving variable snapshots"""
        snippets_data = {
            "VAR1": {
                "variableLabel": "Variable 1",
                "variableType": "Num",
                "derivation": "Test"
            }
        }

        self.service.load_variable_snapshots(self.session_id, snippets_data)
        snapshots = self.service.get_variable_snapshots(self.session_id)

        assert len(snapshots) == 1
        assert snapshots[0].variable_name == "VAR1"

    def test_get_variable_snapshots_with_filter(self):
        """Test retrieving variable snapshots filtered by status"""
        snippets_data = {
            "VAR1": {
                "variableLabel": "Variable 1",
                "variableType": "Num",
                "derivation": "Test"
            },
            "VAR2": {
                "variableLabel": "Variable 2",
                "variableType": "Char",
                "derivation": "Test"
            }
        }

        self.service.load_variable_snapshots(self.session_id, snippets_data)

        # Approve one variable
        self.service.set_variable_approval(
            self.session_id,
            "VAR1",
            VariableApprovalStatus.APPROVED
        )

        # Get only pending
        pending = self.service.get_variable_snapshots(
            self.session_id,
            VariableApprovalStatus.PENDING
        )
        assert len(pending) == 1
        assert pending[0].variable_name == "VAR2"

        # Get only approved
        approved = self.service.get_variable_snapshots(
            self.session_id,
            VariableApprovalStatus.APPROVED
        )
        assert len(approved) == 1
        assert approved[0].variable_name == "VAR1"


class TestVariableApproval:
    """Test variable approval workflow"""

    def setup_method(self):
        """Initialize service, session, and variables"""
        self.service = CodeReviewService()
        self.session = self.service.create_session("STUDY001", "ADSL", "R")
        self.session_id = self.session.session_id

        snippets_data = {
            "VAR1": {
                "variableLabel": "Variable 1",
                "variableType": "Num",
                "derivation": "Test",
                "codeSnippet": "code here"
            }
        }
        self.service.load_variable_snapshots(self.session_id, snippets_data)

    def test_set_variable_approval_approved(self):
        """Test setting variable approval status to APPROVED"""
        snapshot = self.service.set_variable_approval(
            self.session_id,
            "VAR1",
            VariableApprovalStatus.APPROVED,
            comments="Looks good"
        )

        assert snapshot.approval_status == VariableApprovalStatus.APPROVED
        assert snapshot.reviewer_comments == "Looks good"
        assert snapshot.updated_at is not None

    def test_set_variable_approval_changes_requested(self):
        """Test setting variable approval status to CHANGES_REQUESTED"""
        snapshot = self.service.set_variable_approval(
            self.session_id,
            "VAR1",
            VariableApprovalStatus.CHANGES_REQUESTED,
            comments="Please verify edge cases"
        )

        assert snapshot.approval_status == VariableApprovalStatus.CHANGES_REQUESTED
        assert "edge cases" in snapshot.reviewer_comments

    def test_set_approval_for_nonexistent_variable(self):
        """Test setting approval for non-existent variable"""
        with pytest.raises(ValueError):
            self.service.set_variable_approval(
                self.session_id,
                "NONEXISTENT",
                VariableApprovalStatus.APPROVED
            )

    def test_session_status_updates_on_approval(self):
        """Test that session status updates when all variables are approved"""
        # Initially IN_REVIEW
        session = self.service.get_session(self.session_id)
        assert session.status == SessionReviewStatus.IN_REVIEW

        # Approve the variable
        self.service.set_variable_approval(
            self.session_id,
            "VAR1",
            VariableApprovalStatus.APPROVED
        )

        # Session should now be APPROVED
        session = self.service.get_session(self.session_id)
        assert session.status == SessionReviewStatus.APPROVED
        assert session.approved_variables == 1
        assert session.total_variables == 1


class TestSessionCounts:
    """Test session variable count tracking"""

    def setup_method(self):
        """Initialize service and session"""
        self.service = CodeReviewService()
        self.session = self.service.create_session("STUDY001", "ADSL", "R")
        self.session_id = self.session.session_id

    def test_count_updates_on_load(self):
        """Test that counts update when variables are loaded"""
        snippets_data = {
            f"VAR{i}": {
                "variableLabel": f"Variable {i}",
                "variableType": "Num"
            }
            for i in range(5)
        }

        self.service.load_variable_snapshots(self.session_id, snippets_data)

        session = self.service.get_session(self.session_id)
        assert session.total_variables == 5
        assert session.pending_variables == 5
        assert session.approved_variables == 0

    def test_count_updates_on_approval(self):
        """Test that counts update as variables are approved"""
        snippets_data = {
            f"VAR{i}": {
                "variableLabel": f"Variable {i}",
                "variableType": "Num"
            }
            for i in range(3)
        }

        self.service.load_variable_snapshots(self.session_id, snippets_data)

        # Approve two variables
        self.service.set_variable_approval(
            self.session_id, "VAR0", VariableApprovalStatus.APPROVED
        )
        self.service.set_variable_approval(
            self.session_id, "VAR1", VariableApprovalStatus.APPROVED
        )

        session = self.service.get_session(self.session_id)
        assert session.total_variables == 3
        assert session.approved_variables == 2
        assert session.pending_variables == 1


class TestComments:
    """Test comment functionality"""

    def setup_method(self):
        """Initialize service and session"""
        self.service = CodeReviewService()
        self.session = self.service.create_session("STUDY001", "ADSL", "R")
        self.session_id = self.session.session_id

        snippets_data = {
            "VAR1": {
                "variableLabel": "Variable 1",
                "variableType": "Num"
            }
        }
        self.service.load_variable_snapshots(self.session_id, snippets_data)

    def test_add_comment(self):
        """Test adding a comment to a variable"""
        comment = self.service.add_comment(
            self.session_id,
            "VAR1",
            "This looks good but please verify edge cases",
            author="reviewer1"
        )

        assert comment.id is not None
        assert comment.variable_name == "VAR1"
        assert "edge cases" in comment.text
        assert comment.author == "reviewer1"
        assert comment.created_at is not None

    def test_get_comments_by_variable(self):
        """Test retrieving comments for a specific variable"""
        self.service.add_comment(self.session_id, "VAR1", "Comment 1")
        self.service.add_comment(self.session_id, "VAR1", "Comment 2")

        comments = self.service.get_comments(self.session_id, "VAR1")

        assert len(comments) == 2
        assert all(c.variable_name == "VAR1" for c in comments)

    def test_get_all_comments(self):
        """Test retrieving all comments in a session"""
        self.service.add_comment(self.session_id, "VAR1", "Comment 1")
        self.service.add_comment(self.session_id, "VAR1", "Comment 2")

        comments = self.service.get_comments(self.session_id)

        assert len(comments) == 2


class TestSessionWithVariables:
    """Test retrieving complete session data"""

    def setup_method(self):
        """Initialize service and session"""
        self.service = CodeReviewService()
        self.session = self.service.create_session("STUDY001", "ADSL", "R")
        self.session_id = self.session.session_id

        snippets_data = {
            "AGEGR1": {
                "variableLabel": "Age Group 1",
                "variableType": "Char",
                "derivation": "Categorize AGE",
                "pseudoCode": "IF AGE < 65 THEN '<65' ELSE ...",
                "codeSnippet": "ADSL$AGEGR1 <- cut(...)"
            }
        }
        self.service.load_variable_snapshots(self.session_id, snippets_data)
        self.service.add_comment(self.session_id, "AGEGR1", "Test comment")

    def test_get_session_with_variables(self):
        """Test retrieving complete session with variables and comments"""
        result = self.service.get_session_with_variables(self.session_id)

        assert result.session.session_id == self.session_id
        assert len(result.variables) == 1
        assert result.variables[0].variable_name == "AGEGR1"
        assert len(result.comments) == 1
        assert result.comments[0].text == "Test comment"

    def test_get_nonexistent_session_with_variables(self):
        """Test retrieving non-existent session"""
        with pytest.raises(ValueError):
            self.service.get_session_with_variables("nonexistent")


class TestApprovalWorkflow:
    """Test complete approval workflows"""

    def setup_method(self):
        """Initialize service for workflow tests"""
        self.service = CodeReviewService()

    def test_complete_workflow(self):
        """Test complete code review workflow"""
        # Create session
        session = self.service.create_session("STUDY001", "ADSL", "R")
        session_id = session.session_id

        # Load variables
        snippets_data = {
            "VAR1": {"variableLabel": "Variable 1", "variableType": "Num"},
            "VAR2": {"variableLabel": "Variable 2", "variableType": "Char"}
        }
        self.service.load_variable_snapshots(session_id, snippets_data)

        # Check initial status
        session = self.service.get_session(session_id)
        assert session.status == SessionReviewStatus.IN_REVIEW
        assert session.total_variables == 2

        # Add comment to first variable
        self.service.add_comment(session_id, "VAR1", "Minor issue with edge case")

        # Approve first variable
        self.service.set_variable_approval(
            session_id, "VAR1", VariableApprovalStatus.APPROVED
        )

        session = self.service.get_session(session_id)
        assert session.approved_variables == 1
        assert session.status == SessionReviewStatus.IN_REVIEW  # Not all approved yet

        # Request changes for second variable
        self.service.set_variable_approval(
            session_id, "VAR2", VariableApprovalStatus.CHANGES_REQUESTED,
            comments="Please verify logic"
        )

        session = self.service.get_session(session_id)
        assert session.changes_requested_variables == 1
        assert session.status == SessionReviewStatus.CHANGES_REQUESTED

        # Approve second variable
        self.service.set_variable_approval(
            session_id, "VAR2", VariableApprovalStatus.APPROVED
        )

        session = self.service.get_session(session_id)
        assert session.status == SessionReviewStatus.APPROVED
        assert session.approved_variables == 2
        assert session.completed_at is not None
