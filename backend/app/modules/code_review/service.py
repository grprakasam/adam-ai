"""
Code Review Service

Manages code review sessions, variable approval tracking, and comments.
Provides the business logic for the code review workflow.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
from loguru import logger
from .models import (
    CodeReviewSession,
    VariableReviewSnapshot,
    CodeReviewComment,
    VariableApprovalStatus,
    SessionReviewStatus,
    CodeReviewSessionWithVariables
)


class CodeReviewService:
    """Service for managing code review sessions and workflows"""

    def __init__(self):
        """Initialize code review service"""
        # In-memory storage for MVP (will be replaced with database in production)
        self.sessions: Dict[str, CodeReviewSession] = {}
        self.variable_snapshots: Dict[str, List[VariableReviewSnapshot]] = {}
        self.comments: Dict[str, List[CodeReviewComment]] = {}
        self.session_counter = 0

        logger.info("✅ Initialized CodeReviewService")

    def create_session(
        self,
        study_id: str,
        adam_dataset: str,
        programming_language: str
    ) -> CodeReviewSession:
        """
        Create a new code review session for a study/dataset.

        Args:
            study_id: Study identifier
            adam_dataset: ADAM dataset name (ADSL, ADAE, etc.)
            programming_language: Programming language (R or SAS)

        Returns:
            New CodeReviewSession
        """
        self.session_counter += 1
        session_id = f"session_{study_id}_{adam_dataset}_{self.session_counter}"

        session = CodeReviewSession(
            session_id=session_id,
            study_id=study_id,
            adam_dataset=adam_dataset,
            programming_language=programming_language,
            status=SessionReviewStatus.NOT_STARTED,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        self.sessions[session_id] = session
        self.variable_snapshots[session_id] = []
        self.comments[session_id] = []

        logger.info(f"Created code review session: {session_id}")
        return session

    def get_session(self, session_id: str) -> Optional[CodeReviewSession]:
        """Get session by ID"""
        return self.sessions.get(session_id)

    def load_variable_snapshots(
        self,
        session_id: str,
        snippets_data: Dict[str, Any]
    ) -> List[VariableReviewSnapshot]:
        """
        Load variable snapshots from Pair Programming data into code review.

        Args:
            session_id: Code review session ID
            snippets_data: pairProgramming.snippets dictionary from frontend

        Returns:
            List of VariableReviewSnapshot objects
        """
        if session_id not in self.sessions:
            logger.error(f"Session not found: {session_id}")
            raise ValueError(f"Session not found: {session_id}")

        snapshots: List[VariableReviewSnapshot] = []

        for var_name, snippet_data in snippets_data.items():
            snapshot = VariableReviewSnapshot(
                variable_name=var_name,
                variable_label=snippet_data.get('variableLabel'),
                variable_type=snippet_data.get('variableType'),
                derivation_logic=snippet_data.get('derivation'),
                pseudo_code=snippet_data.get('pseudoCode'),
                pseudo_summary=snippet_data.get('pseudoSummary'),
                code_snippet=snippet_data.get('codeSnippet'),
                coding_rationale=snippet_data.get('codingRationale'),
                user_notes=snippet_data.get('userNotes'),
                approval_status=VariableApprovalStatus.PENDING,
                language=self.sessions[session_id].programming_language,
                has_pseudo_code=bool(snippet_data.get('pseudoCode')),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            snapshots.append(snapshot)

        self.variable_snapshots[session_id] = snapshots
        self._update_session_counts(session_id)
        self._update_session_status(session_id)  # Transition from NOT_STARTED to IN_REVIEW

        logger.info(f"Loaded {len(snapshots)} variable snapshots for session {session_id}")
        return snapshots

    def get_variable_snapshots(
        self,
        session_id: str,
        status_filter: Optional[VariableApprovalStatus] = None
    ) -> List[VariableReviewSnapshot]:
        """
        Get variable snapshots for a session, optionally filtered by status.

        Args:
            session_id: Code review session ID
            status_filter: Optional status filter (PENDING, APPROVED, CHANGES_REQUESTED)

        Returns:
            List of VariableReviewSnapshot objects
        """
        if session_id not in self.variable_snapshots:
            return []

        snapshots = self.variable_snapshots[session_id]

        if status_filter:
            snapshots = [s for s in snapshots if s.approval_status == status_filter]

        return snapshots

    def set_variable_approval(
        self,
        session_id: str,
        variable_name: str,
        status: VariableApprovalStatus,
        comments: Optional[str] = None
    ) -> VariableReviewSnapshot:
        """
        Update approval status for a variable.

        Args:
            session_id: Code review session ID
            variable_name: Variable name to update
            status: New approval status
            comments: Optional reviewer comments

        Returns:
            Updated VariableReviewSnapshot
        """
        if session_id not in self.variable_snapshots:
            raise ValueError(f"Session not found: {session_id}")

        snapshots = self.variable_snapshots[session_id]
        snapshot = next((s for s in snapshots if s.variable_name == variable_name), None)

        if not snapshot:
            raise ValueError(f"Variable not found: {variable_name}")

        # Update status and comments
        snapshot.approval_status = status
        if comments:
            snapshot.reviewer_comments = comments
        snapshot.updated_at = datetime.utcnow()

        # Update session counts and status
        self._update_session_counts(session_id)
        self._update_session_status(session_id)

        logger.info(
            f"Updated {variable_name} approval status to {status} in session {session_id}"
        )

        return snapshot

    def add_comment(
        self,
        session_id: str,
        variable_name: str,
        text: str,
        author: Optional[str] = None
    ) -> CodeReviewComment:
        """
        Add a comment to a variable.

        Args:
            session_id: Code review session ID
            variable_name: Variable to comment on
            text: Comment text
            author: Optional comment author

        Returns:
            New CodeReviewComment
        """
        if session_id not in self.comments:
            raise ValueError(f"Session not found: {session_id}")

        comment = CodeReviewComment(
            id=f"comment_{session_id}_{variable_name}_{len(self.comments[session_id])}",
            variable_name=variable_name,
            text=text,
            author=author or "Anonymous",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        self.comments[session_id].append(comment)

        logger.info(f"Added comment to {variable_name} in session {session_id}")
        return comment

    def get_comments(
        self,
        session_id: str,
        variable_name: Optional[str] = None
    ) -> List[CodeReviewComment]:
        """
        Get comments for a session or specific variable.

        Args:
            session_id: Code review session ID
            variable_name: Optional filter to specific variable

        Returns:
            List of CodeReviewComment objects
        """
        if session_id not in self.comments:
            return []

        comments = self.comments[session_id]

        if variable_name:
            comments = [c for c in comments if c.variable_name == variable_name]

        return comments

    def get_session_with_variables(
        self,
        session_id: str
    ) -> CodeReviewSessionWithVariables:
        """
        Get complete session data including all variables and comments.

        Args:
            session_id: Code review session ID

        Returns:
            CodeReviewSessionWithVariables with all data
        """
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        variables = self.get_variable_snapshots(session_id)
        comments = self.get_comments(session_id)

        return CodeReviewSessionWithVariables(
            session=session,
            variables=variables,
            comments=comments
        )

    def _update_session_counts(self, session_id: str) -> None:
        """Update variable count statistics in session"""
        if session_id not in self.sessions:
            return

        snapshots = self.variable_snapshots[session_id]
        session = self.sessions[session_id]

        session.total_variables = len(snapshots)
        session.approved_variables = len(
            [s for s in snapshots if s.approval_status == VariableApprovalStatus.APPROVED]
        )
        session.pending_variables = len(
            [s for s in snapshots if s.approval_status == VariableApprovalStatus.PENDING]
        )
        session.changes_requested_variables = len(
            [s for s in snapshots
             if s.approval_status == VariableApprovalStatus.CHANGES_REQUESTED]
        )
        session.updated_at = datetime.utcnow()

    def _update_session_status(self, session_id: str) -> None:
        """Update overall session status based on variable statuses"""
        if session_id not in self.sessions:
            return

        session = self.sessions[session_id]
        snapshots = self.variable_snapshots[session_id]

        if not snapshots:
            session.status = SessionReviewStatus.NOT_STARTED
            return

        # Determine status based on variable approvals
        all_approved = all(
            s.approval_status == VariableApprovalStatus.APPROVED
            for s in snapshots
        )

        has_changes_requested = any(
            s.approval_status == VariableApprovalStatus.CHANGES_REQUESTED
            for s in snapshots
        )

        if all_approved:
            session.status = SessionReviewStatus.APPROVED
            session.completed_at = datetime.utcnow()
        elif has_changes_requested:
            session.status = SessionReviewStatus.CHANGES_REQUESTED
        else:
            session.status = SessionReviewStatus.IN_REVIEW

        session.updated_at = datetime.utcnow()

    def clear_session(self, session_id: str) -> None:
        """Clear a session (for testing or cleanup)"""
        if session_id in self.sessions:
            del self.sessions[session_id]
        if session_id in self.variable_snapshots:
            del self.variable_snapshots[session_id]
        if session_id in self.comments:
            del self.comments[session_id]
        logger.info(f"Cleared code review session: {session_id}")


# Global service instance
_code_review_service: Optional[CodeReviewService] = None


def get_code_review_service() -> CodeReviewService:
    """Get or create code review service instance"""
    global _code_review_service
    if _code_review_service is None:
        _code_review_service = CodeReviewService()
    return _code_review_service
