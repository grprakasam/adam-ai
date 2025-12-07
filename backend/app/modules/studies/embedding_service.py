"""
Embedding generation service for document chunks
Supports multiple embedding models (OpenAI, sentence-transformers, etc.)
"""
import os
from typing import List, Optional
from loguru import logger

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    logger.warning("sentence-transformers not available, embeddings will use fallback")


class EmbeddingService:
    """
    Generate embeddings for document chunks
    Uses sentence-transformers by default, can be extended for OpenAI/Gemini
    """

    def __init__(self, model_name: Optional[str] = None):
        """
        Initialize embedding service

        Args:
            model_name: Name of embedding model to use
        """
        self.model_name = model_name or os.getenv(
            "EMBEDDING_MODEL",
            "all-MiniLM-L6-v2"  # Lightweight, fast model
        )
        self.model = None
        self._load_model()

    def _load_model(self):
        """Load embedding model"""
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                logger.info(f"Loading embedding model: {self.model_name}")
                self.model = SentenceTransformer(self.model_name)
                logger.info("Embedding model loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load embedding model: {e}")
                self.model = None
        else:
            logger.warning("sentence-transformers not available, using fallback")

    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding vector for a single text

        Args:
            text: Text to embed

        Returns:
            List of floats representing the embedding vector
        """
        if not text or not text.strip():
            # Return zero vector for empty text
            return [0.0] * 384  # Default dimension for all-MiniLM-L6-v2

        if self.model:
            try:
                embedding = self.model.encode(text, normalize_embeddings=True)
                return embedding.tolist()
            except Exception as e:
                logger.error(f"Error generating embedding: {e}")
                return self._fallback_embedding(text)
        else:
            return self._fallback_embedding(text)

    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Batch generate embeddings for efficiency

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []

        if self.model:
            try:
                embeddings = self.model.encode(
                    texts,
                    normalize_embeddings=True,
                    batch_size=32,
                    show_progress_bar=False
                )
                return embeddings.tolist()
            except Exception as e:
                logger.error(f"Error generating batch embeddings: {e}")
                return [self._fallback_embedding(text) for text in texts]
        else:
            return [self._fallback_embedding(text) for text in texts]

    def _fallback_embedding(self, text: str) -> List[float]:
        """
        Fallback embedding method (simple hash-based)
        Not recommended for production, but ensures service doesn't break
        """
        # Simple hash-based embedding (not semantic, just for compatibility)
        import hashlib
        hash_obj = hashlib.sha256(text.encode())
        hash_bytes = hash_obj.digest()
        # Convert to float vector (384 dimensions)
        embedding = []
        for i in range(0, min(len(hash_bytes), 384), 2):
            if i + 1 < len(hash_bytes):
                val = (hash_bytes[i] * 256 + hash_bytes[i + 1]) / 65535.0
                embedding.append(val)
        # Pad to 384 dimensions
        while len(embedding) < 384:
            embedding.append(0.0)
        return embedding[:384]

    def get_embedding_dimension(self) -> int:
        """Get the dimension of embedding vectors"""
        if self.model:
            # Test with a dummy text
            test_embedding = self.generate_embedding("test")
            return len(test_embedding)
        return 384  # Default dimension





