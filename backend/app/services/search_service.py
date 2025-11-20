"""
Search service for global search functionality
Uses PostgreSQL full-text search
"""
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.study_models import SearchResult, SearchType


class SearchService:
    """Service for global search across all resources"""

    def __init__(self, db: Session, user_id: str):
        self.db = db
        self.user_id = user_id

    def search(
        self,
        query: str,
        study_id: Optional[str] = None,
        types: Optional[List[SearchType]] = None,
        limit: int = 50
    ) -> List[SearchResult]:
        """
        Perform global search

        Args:
            query: Search query
            study_id: Optional study filter
            types: Optional type filters
            limit: Max results

        Returns:
            List of SearchResult objects
        """
        results = []

        # Search in studies
        if not types or SearchType.STUDY in types:
            results.extend(self._search_studies(query, limit))

        # Search in variables
        if not types or SearchType.VARIABLE in types:
            results.extend(self._search_variables(query, study_id, limit))

        # Search in code snippets
        if not types or SearchType.CODE in types:
            results.extend(self._search_code(query, study_id, limit))

        # Search in datasets
        if not types or SearchType.DATASET in types:
            results.extend(self._search_datasets(query, study_id, limit))

        # Sort by relevance score
        results.sort(key=lambda x: x.relevance_score or 0, reverse=True)

        return results[:limit]

    def get_suggestions(self, query: str, limit: int = 10) -> List[str]:
        """
        Get search suggestions

        Args:
            query: Partial query
            limit: Max suggestions

        Returns:
            List of suggestion strings
        """
        # Search for study names, variable names
        suggestions = []

        # Studies
        study_query = """
            SELECT DISTINCT name FROM studies
            WHERE LOWER(name) LIKE :query
              AND is_deleted = FALSE
            LIMIT :limit
        """
        studies = self.db.execute(study_query, {
            "query": f"%{query.lower()}%",
            "limit": limit
        }).fetchall()

        suggestions.extend([row[0] for row in studies])

        return suggestions[:limit]

    def _search_studies(self, query: str, limit: int) -> List[SearchResult]:
        """Search in studies"""
        sql = """
            SELECT s.id, s.name, s.protocol_number, s.sponsor,
                   ts_rank(
                       to_tsvector('english', s.name || ' ' || COALESCE(s.protocol_number, '') || ' ' || COALESCE(s.sponsor, '')),
                       plainto_tsquery('english', :query)
                   ) as relevance
            FROM studies s
            INNER JOIN study_access sa ON s.id = sa.study_id
            WHERE sa.user_id = :user_id
              AND sa.is_active = TRUE
              AND s.is_deleted = FALSE
              AND (
                  to_tsvector('english', s.name || ' ' || COALESCE(s.protocol_number, '') || ' ' || COALESCE(s.sponsor, ''))
                  @@ plainto_tsquery('english', :query)
              )
            ORDER BY relevance DESC
            LIMIT :limit
        """

        results = self.db.execute(sql, {
            "query": query,
            "user_id": self.user_id,
            "limit": limit
        }).fetchall()

        return [
            SearchResult(
                type=SearchType.STUDY,
                title=row[1],
                description=f"Protocol: {row[2]}, Sponsor: {row[3]}" if row[2] else f"Sponsor: {row[3]}",
                study_id=row[0],
                url=f"/studies/{row[0]}",
                relevance_score=float(row[4])
            )
            for row in results
        ]

    def _search_variables(self, query: str, study_id: Optional[str], limit: int) -> List[SearchResult]:
        """Search in variables"""
        # TODO: Implement when variable storage is available
        return []

    def _search_code(self, query: str, study_id: Optional[str], limit: int) -> List[SearchResult]:
        """Search in code snippets"""
        # TODO: Implement when code storage is available
        return []

    def _search_datasets(self, query: str, study_id: Optional[str], limit: int) -> List[SearchResult]:
        """Search in datasets"""
        sql = """
            SELECT sd.id, sd.dataset_name, sd.study_id, s.name as study_name,
                   1.0 as relevance
            FROM study_datasets sd
            INNER JOIN studies s ON sd.study_id = s.id
            INNER JOIN study_access sa ON s.id = sa.study_id
            WHERE sa.user_id = :user_id
              AND sa.is_active = TRUE
              AND s.is_deleted = FALSE
              AND LOWER(sd.dataset_name) LIKE :query
        """

        params = {
            "query": f"%{query.lower()}%",
            "user_id": self.user_id
        }

        if study_id:
            sql += " AND sd.study_id = :study_id"
            params["study_id"] = study_id

        sql += " LIMIT :limit"
        params["limit"] = limit

        results = self.db.execute(sql, params).fetchall()

        return [
            SearchResult(
                type=SearchType.DATASET,
                title=row[1],
                description=f"Study: {row[3]}",
                study_id=row[2],
                url=f"/studies/{row[2]}/datasets/{row[1]}",
                relevance_score=float(row[4])
            )
            for row in results
        ]
