"""LangChain character chunking with source offsets preserved for citations."""
from typing import List
from langchain_text_splitters import RecursiveCharacterTextSplitter

class TextChunker:
    def __init__(self, chunk_size=500, chunk_overlap=50, separators: List[str] = None):
        if chunk_size <= 0 or not 0 <= chunk_overlap < chunk_size:
            raise ValueError("Require 0 <= overlap < chunk size")
        self.chunk_size, self.chunk_overlap = chunk_size, chunk_overlap
        self.separators = separators or ["\n\n", "\n", ". ", " ", ""]

    def chunk_text(self, text):
        if not text or not text.strip():
            return []
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap,
            separators=self.separators, add_start_index=True)
        documents = splitter.create_documents([text])
        return [{"text": d.page_content, "index": i, "start_pos": d.metadata["start_index"],
                 "end_pos": d.metadata["start_index"] + len(d.page_content)}
                for i, d in enumerate(documents)]

    def chunk_text_by_tokens(self, text, tokenizer=None):
        if tokenizer is not None:
            raise ValueError("Tokenizer-specific splitting is not supported; use character chunking")
        return TextChunker(self.chunk_size * 4, self.chunk_overlap * 4, self.separators).chunk_text(text)








