"""
Text chunking utility for document processing
Splits text into chunks suitable for embedding and retrieval
"""
from typing import List
from loguru import logger


class TextChunker:
    """Chunk text into smaller pieces for embedding"""

    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        separators: List[str] = None
    ):
        """
        Initialize text chunker

        Args:
            chunk_size: Target size of each chunk (in tokens/characters)
            chunk_overlap: Number of tokens/characters to overlap between chunks
            separators: List of separators to prefer when splitting
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", ". ", " ", ""]

    def chunk_text(self, text: str) -> List[dict]:
        """
        Split text into chunks

        Args:
            text: Text to chunk

        Returns:
            List of chunk dictionaries with text and metadata
        """
        if not text or not text.strip():
            return []

        chunks = []
        current_pos = 0
        chunk_index = 0

        while current_pos < len(text):
            # Determine chunk end position
            chunk_end = min(current_pos + self.chunk_size, len(text))

            # Try to find a good break point
            chunk_text = text[current_pos:chunk_end]

            # If not at end of text, try to break at a separator
            if chunk_end < len(text):
                for separator in self.separators:
                    if separator:
                        last_sep_pos = chunk_text.rfind(separator)
                        if last_sep_pos > self.chunk_size * 0.5:  # Don't break too early
                            chunk_text = chunk_text[:last_sep_pos + len(separator)]
                            chunk_end = current_pos + len(chunk_text)
                            break

            # Clean up chunk text
            chunk_text = chunk_text.strip()

            if chunk_text:
                chunks.append({
                    "text": chunk_text,
                    "index": chunk_index,
                    "start_pos": current_pos,
                    "end_pos": chunk_end
                })
                chunk_index += 1

            # Move to next chunk with overlap
            current_pos = chunk_end - self.chunk_overlap
            if current_pos <= 0:
                current_pos = chunk_end

        return chunks

    def chunk_text_by_tokens(self, text: str, tokenizer=None) -> List[dict]:
        """
        Chunk text by tokens (more accurate but requires tokenizer)

        Args:
            text: Text to chunk
            tokenizer: Tokenizer function or object

        Returns:
            List of chunk dictionaries
        """
        # Simple implementation - can be enhanced with actual tokenizer
        # For now, approximate tokens as characters / 4
        approximate_tokens = len(text) // 4
        chunk_size_tokens = self.chunk_size
        chunk_overlap_tokens = self.chunk_overlap

        # Convert to character-based chunking
        char_chunk_size = chunk_size_tokens * 4
        char_chunk_overlap = chunk_overlap_tokens * 4

        # Temporarily adjust chunk size
        original_chunk_size = self.chunk_size
        original_overlap = self.chunk_overlap

        self.chunk_size = char_chunk_size
        self.chunk_overlap = char_chunk_overlap

        try:
            return self.chunk_text(text)
        finally:
            self.chunk_size = original_chunk_size
            self.chunk_overlap = original_overlap




