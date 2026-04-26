"""
Configuration settings for the EasyRag application.
"""
import os

# Database settings
DATABASE_PATH = os.path.join(os.path.dirname(__file__), "data", "rag.db")
EMBEDDING_DIMENSION = 384  # Dimension for all-MiniLM-L6-v2 model

# Upload settings
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB max file size
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx"}

# Embedding settings
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
CHUNK_SIZE = 500  # Characters per chunk
CHUNK_OVERLAP = 50  # Overlap between chunks

# RAG settings
TOP_K_RESULTS = 5  # Number of relevant chunks to retrieve

# Ensure directories exist
os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)