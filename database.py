"""
Database module for managing sqlite-vec vector storage.
"""
import sqlite3
import json
from typing import List, Optional
import config


class VectorDatabase:
    """Manages vector storage using sqlite-vec extension."""
    
    def __init__(self):
        """Initialize the database connection and create tables."""
        self.conn = None
        self._connect()
        self._create_tables()
    
    def _connect(self):
        """Connect to SQLite database with sqlite-vec extension."""
        import sqlite_vec
        self.conn = sqlite3.connect(config.DATABASE_PATH)
        self.conn.enable_load_extension(True)
        sqlite_vec.load(self.conn)
        self.conn.enable_load_extension(False)
    
    def _create_tables(self):
        """Create necessary tables for vector storage."""
        cursor = self.conn.cursor()
        
        # Create virtual table for vectors using sqlite-vec
        cursor.execute(f"""
            CREATE VIRTUAL TABLE IF NOT EXISTS vec_documents USING vec0(
                embedding FLOAT[{config.EMBEDDING_DIMENSION}]
            )
        """)
        
        # Create regular table to store document metadata
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vec_id INTEGER,
                filename TEXT NOT NULL,
                chunk_index INTEGER,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vec_id) REFERENCES vec_documents(rowid)
            )
        """)
        
        self.conn.commit()
    
    def insert_document(self, filename: str, chunk_index: int, content: str, embedding: List[float]) -> int:
        """
        Insert a document chunk with its embedding.
        
        Args:
            filename: Name of the source file
            chunk_index: Index of this chunk in the document
            content: Text content of the chunk
            embedding: Vector embedding of the content
            
        Returns:
            Document ID
        """
        cursor = self.conn.cursor()
        
        # Insert embedding into vector table
        cursor.execute(
            "INSERT INTO vec_documents(embedding) VALUES (?)",
            [json.dumps(embedding)]
        )
        vec_id = cursor.lastrowid
        
        # Insert metadata into documents table
        cursor.execute(
            "INSERT INTO documents(vec_id, filename, chunk_index, content) VALUES (?, ?, ?, ?)",
            (vec_id, filename, chunk_index, content)
        )
        
        self.conn.commit()
        return cursor.lastrowid
    
    def search_similar(self, query_embedding: List[float], top_k: int = config.TOP_K_RESULTS) -> List[dict]:
        """
        Search for documents similar to the query embedding.
        
        Args:
            query_embedding: Vector embedding of the query
            top_k: Number of results to return
            
        Returns:
            List of matching documents with similarity scores
        """
        cursor = self.conn.cursor()
        
        cursor.execute("""
            SELECT 
                d.id,
                d.filename,
                d.chunk_index,
                d.content,
                v.distance
            FROM vec_documents v
            JOIN documents d ON d.vec_id = v.rowid
            WHERE v.embedding MATCH ? AND k = ?
            ORDER BY v.distance
        """, [json.dumps(query_embedding), top_k])
        
        results = []
        for row in cursor.fetchall():
            results.append({
                "id": row[0],
                "filename": row[1],
                "chunk_index": row[2],
                "content": row[3],
                "distance": row[4]
            })
        
        return results
    
    def get_all_documents(self) -> List[dict]:
        """Get all stored documents."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT DISTINCT filename, COUNT(*) as chunk_count, MIN(created_at) as created_at
            FROM documents
            GROUP BY filename
            ORDER BY created_at DESC
        """)
        
        results = []
        for row in cursor.fetchall():
            results.append({
                "filename": row[0],
                "chunk_count": row[1],
                "created_at": row[2]
            })
        
        return results
    
    def delete_document(self, filename: str) -> bool:
        """
        Delete a document and all its chunks.
        
        Args:
            filename: Name of the file to delete
            
        Returns:
            True if deleted, False if not found
        """
        cursor = self.conn.cursor()
        
        # Get vector IDs for the document
        cursor.execute("SELECT vec_id FROM documents WHERE filename = ?", (filename,))
        vec_ids = [row[0] for row in cursor.fetchall()]
        
        if not vec_ids:
            return False
        
        # Delete from vector table
        for vec_id in vec_ids:
            cursor.execute("DELETE FROM vec_documents WHERE rowid = ?", (vec_id,))
        
        # Delete from documents table
        cursor.execute("DELETE FROM documents WHERE filename = ?", (filename,))
        
        self.conn.commit()
        return True
    
    def close(self):
        """Close the database connection."""
        if self.conn:
            self.conn.close()


# Global database instance
_db_instance: Optional[VectorDatabase] = None


def get_db() -> VectorDatabase:
    """Get or create database instance."""
    global _db_instance
    if _db_instance is None:
        _db_instance = VectorDatabase()
    return _db_instance