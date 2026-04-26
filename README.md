# EasyRag

A lightweight Retrieval-Augmented Generation (RAG) system with a web interface. Upload documents, ask questions, and retrieve semantically relevant passages.

## Features

- 📄 Upload TXT, PDF, DOCX files via drag-and-drop
- 🧩 Automatic chunking with sentence-aware break points
- 🔍 Semantic search powered by SentenceTransformers (`all-MiniLM-L6-v2`)
- 🗄️ Vector storage with sqlite-vec — no external database needed
- 🖥️ Dark-themed web UI

## Quick Start

```bash
git clone https://github.com/Ratman463/EasyRag.git
cd EasyRag
pip install -r requirements.txt
python main.py
```

Open **http://localhost:8000** in your browser.

> SentenceTransformers automatically downloads the embedding model on first run — no manual setup needed.

## Configuration

All settings are in `config.py`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | SentenceTransformers model name |
| `EMBEDDING_DIMENSION` | `384` | Vector dimension (must match model) |
| `CHUNK_SIZE` | `500` | Max characters per chunk |
| `CHUNK_OVERLAP` | `50` | Overlap between chunks |
| `TOP_K_RESULTS` | `5` | Default number of query results |
| `MAX_UPLOAD_SIZE` | `50 MB` | Max upload file size |
| `DATABASE_PATH` | `data/rag.db` | SQLite database path |

## Project Structure

```
EasyRag/
├── main.py          # FastAPI app & API endpoints
├── config.py        # Configuration
├── database.py      # sqlite-vec vector database
├── embedding.py     # SentenceTransformers embedding & chunking
├── requirements.txt
├── data/rag.db      # Database (auto-created)
├── uploads/         # Uploaded files
└── static/          # Web UI (HTML/CSS/JS)
```