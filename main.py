"""
FastAPI backend server for EasyRag application.
"""
import os
import shutil
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
import config
from database import get_db
from embedding import get_embedding_engine, DocumentProcessor


# Pydantic models for API
class QueryRequest(BaseModel):
    """Request model for querying."""
    question: str
    top_k: Optional[int] = config.TOP_K_RESULTS


class SearchResult(BaseModel):
    """Model for search result."""
    id: int
    filename: str
    chunk_index: int
    content: str
    distance: float
    similarity: float


class QueryResponse(BaseModel):
    """Response model for query."""
    results: List[SearchResult]
    query: str


class DocumentInfo(BaseModel):
    """Model for document information."""
    filename: str
    chunk_count: int
    created_at: str


class UploadResponse(BaseModel):
    """Response model for upload."""
    message: str
    filename: str
    chunks_added: int


# Create FastAPI app
app = FastAPI(
    title="EasyRag API",
    description="A simple RAG system using sqlite-vec",
    version="1.0.0"
)


# Serve static files (frontend)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.on_event("startup")
async def startup_event():
    """Initialize components on startup."""
    # Initialize database and embedding engine
    get_db()
    get_embedding_engine()
    print("EasyRag server started successfully!")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    db = get_db()
    db.close()
    print("EasyRag server shutdown complete.")


@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the main frontend page."""
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()


@app.post("/api/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload and process a document.
    
    Supported formats: PDF, TXT, DOCX
    """
    # Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in config.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {config.ALLOWED_EXTENSIONS}"
        )
    
    # Save uploaded file
    file_path = os.path.join(config.UPLOAD_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Process document
    try:
        text = DocumentProcessor.read_document(file_path)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Document appears to be empty")
        
        # Get embedding engine and process text
        engine = get_embedding_engine()
        chunks_with_embeddings = engine.process_text(text)
        
        if not chunks_with_embeddings:
            raise HTTPException(status_code=400, detail="No content could be extracted from document")
        
        # Store in database
        db = get_db()
        for idx, (chunk, embedding) in enumerate(chunks_with_embeddings):
            db.insert_document(
                filename=file.filename,
                chunk_index=idx,
                content=chunk,
                embedding=embedding
            )
        
        return UploadResponse(
            message="Document uploaded and processed successfully",
            filename=file.filename,
            chunks_added=len(chunks_with_embeddings)
        )
        
    except Exception as e:
        # Clean up file if processing failed
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")


@app.post("/api/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    """
    Query the RAG system for relevant document chunks.
    
    Returns the most similar chunks from the knowledge base.
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    
    try:
        # Get query embedding
        engine = get_embedding_engine()
        query_embedding = engine.embed_text(request.question)
        
        # Search database
        db = get_db()
        results = db.search_similar(query_embedding, request.top_k)
        
        if not results:
            return QueryResponse(results=[], query=request.question)
        
        search_results = [
            SearchResult(
                id=r["id"],
                filename=r["filename"],
                chunk_index=r["chunk_index"],
                content=r["content"],
                distance=r["distance"],
                similarity=1-r["distance"]
            )
            for r in results
        ]

        print(search_results)
        
        return QueryResponse(results=search_results, query=request.question)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


@app.get("/api/documents", response_model=List[DocumentInfo])
async def list_documents():
    """List all uploaded documents."""
    try:
        db = get_db()
        documents = db.get_all_documents()
        return [
            DocumentInfo(
                filename=doc["filename"],
                chunk_count=doc["chunk_count"],
                created_at=doc["created_at"]
            )
            for doc in documents
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list documents: {str(e)}")


@app.delete("/api/documents/{filename}")
async def delete_document(filename: str):
    """Delete a document and all its chunks."""
    try:
        db = get_db()
        deleted = db.delete_document(filename)
        
        if not deleted:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Also delete file from uploads
        file_path = os.path.join(config.UPLOAD_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
        
        return {"message": f"Document '{filename}' deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "EasyRag"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)