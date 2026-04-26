// API Base URL
const API_BASE = '/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDocuments();
    setupUploadArea();
});

// Setup upload area drag and drop
function setupUploadArea() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            uploadFile(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadFile(e.target.files[0]);
        }
    });
}

// Upload file
async function uploadFile(file) {
    const statusDiv = document.getElementById('upload-status');
    statusDiv.innerHTML = '<div class="status info"><span class="loading"></span> Uploading and processing...</div>';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            statusDiv.innerHTML = `<div class="status success">✅ ${data.message}<br>File: ${data.filename}<br>Chunks added: ${data.chunks_added}</div>`;
            loadDocuments();
        } else {
            statusDiv.innerHTML = `<div class="status error">❌ Error: ${data.detail}</div>`;
        }
    } catch (error) {
        statusDiv.innerHTML = `<div class="status error">❌ Upload failed: ${error.message}</div>`;
    }
}

// Load documents
async function loadDocuments() {
    const container = document.getElementById('documents-container');

    try {
        const response = await fetch(`${API_BASE}/documents`);
        const documents = await response.json();

        if (documents.length === 0) {
            container.innerHTML = '<div class="empty-state">No documents uploaded yet</div>';
            return;
        }

        container.innerHTML = '<div class="documents-list">' +
            documents.map(doc => `
                <div class="document-item">
                    <div class="document-info">
                        <div class="document-name">📄 ${doc.filename}</div>
                        <div class="document-meta">${doc.chunk_count} chunks • ${new Date(doc.created_at).toLocaleString()}</div>
                    </div>
                    <button class="btn btn-danger btn-delete" onclick="deleteDocument('${doc.filename}')">Delete</button>
                </div>
            `).join('') +
            '</div>';
    } catch (error) {
        container.innerHTML = `<div class="status error">Failed to load documents: ${error.message}</div>`;
    }
}

// Delete document
async function deleteDocument(filename) {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadDocuments();
        } else {
            const data = await response.json();
            alert(`Error: ${data.detail}`);
        }
    } catch (error) {
        alert(`Failed to delete: ${error.message}`);
    }
}

// Query documents
async function queryDocuments() {
    const queryInput = document.getElementById('query-input');
    const topK = document.getElementById('top-k').value;
    const query = queryInput.value.trim();

    if (!query) {
        alert('Please enter a question');
        return;
    }

    const queryBtn = document.getElementById('query-btn');
    const resultsCard = document.getElementById('results-card');
    const resultsContainer = document.getElementById('results-container');

    // Show loading state
    queryBtn.disabled = true;
    queryBtn.innerHTML = '<span class="loading"></span> Searching...';
    resultsCard.style.display = 'block';
    resultsContainer.innerHTML = '<div class="status info">Searching knowledge base...</div>';

    try {
        const response = await fetch(`${API_BASE}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: query,
                top_k: parseInt(topK)
            })
        });

        const data = await response.json();

        if (data.results.length === 0) {
            resultsContainer.innerHTML = '<div class="empty-state">No relevant documents found. Try uploading some documents first!</div>';
        } else {
            resultsContainer.innerHTML = data.results.map((result, index) => `
                <div class="result-item">
                    <div class="result-header">
                        <span class="result-source">📄 ${result.filename} (Chunk ${result.chunk_index + 1})</span>
                        <span class="result-score">Score: ${result.similarity.toFixed(4)}</span>
                    </div>
                    <div class="result-content">${escapeHtml(result.content)}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        resultsContainer.innerHTML = `<div class="status error">Query failed: ${error.message}</div>`;
    } finally {
        queryBtn.disabled = false;
        queryBtn.innerHTML = 'Search';
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Allow Enter key to submit query
document.getElementById('query-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        queryDocuments();
    }
});