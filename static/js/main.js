// API Base URL
const API_BASE = '/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDocuments();
    setupUploadArea();
    setupNavigation();
});

// ===== Section Navigation =====
function switchSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });

    // Show target section
    const target = document.getElementById(`section-${sectionName}`);
    if (target) {
        target.style.display = 'block';
        // Trigger animation
        requestAnimationFrame(() => {
            target.classList.add('active');
        });
    }

    // Update sidebar active state
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === sectionName) {
            item.classList.add('active');
        }
    });

    // Update nav active state
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === sectionName) {
            link.classList.add('active');
        }
    });

    // Show results section if that's where we're going
    if (sectionName === 'results') {
        const resultsSection = document.getElementById('section-results');
        if (resultsSection) resultsSection.style.display = 'block';
    }
}

function setupNavigation() {
    // Nav links click handlers
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchSection(link.dataset.section);
        });
    });

    // Show upload section by default
    switchSection('upload');
}

// ===== Upload Area =====
function setupUploadArea() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    if (!uploadArea) return;

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
            statusDiv.innerHTML = `<div class="status success">Uploaded: ${escapeHtml(data.filename)} — ${data.chunks_added} chunks added</div>`;
            loadDocuments();
        } else {
            statusDiv.innerHTML = `<div class="status error">Error: ${escapeHtml(data.detail)}</div>`;
        }
    } catch (error) {
        statusDiv.innerHTML = `<div class="status error">Upload failed: ${escapeHtml(error.message)}</div>`;
    }
}

// ===== Documents =====
async function loadDocuments() {
    const container = document.getElementById('documents-container');

    try {
        const response = await fetch(`${API_BASE}/documents`);
        const documents = await response.json();

        if (documents.length === 0) {
            container.innerHTML = '<div class="empty-state">No documents uploaded yet. Drop files in the Upload section to get started.</div>';
            updateCounter('docs-counter', '');
            updateCounter('upload-counter', '');
            return;
        }

        const totalChunks = documents.reduce((sum, doc) => sum + doc.chunk_count, 0);
        updateCounter('docs-counter', `${documents.length} docs · ${totalChunks} chunks`);
        updateCounter('upload-counter', `${documents.length} documents`);

        container.innerHTML = '<div class="documents-list">' +
            documents.map(doc => `
                <div class="document-item">
                    <div class="document-info">
                        <div class="document-name">${escapeHtml(doc.filename)}</div>
                        <div class="document-meta">${doc.chunk_count} chunks · ${new Date(doc.created_at).toLocaleDateString()}</div>
                    </div>
                    <button class="btn-delete" onclick="deleteDocument('${escapeHtml(doc.filename)}')">Delete</button>
                </div>
            `).join('') +
            '</div>';
    } catch (error) {
        container.innerHTML = `<div class="status error">Failed to load documents: ${escapeHtml(error.message)}</div>`;
    }
}

// Delete document
async function deleteDocument(filename) {
    if (!confirm(`Delete "${filename}"?`)) {
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

// ===== Query =====
async function queryDocuments() {
    const queryInput = document.getElementById('query-input');
    const topK = document.getElementById('top-k').value;
    const query = queryInput.value.trim();

    if (!query) {
        queryInput.focus();
        queryInput.style.borderColor = 'var(--danger)';
        setTimeout(() => { queryInput.style.borderColor = ''; }, 2000);
        return;
    }

    const queryBtn = document.getElementById('query-btn');
    const resultsSection = document.getElementById('section-results');
    const resultsContainer = document.getElementById('results-container');

    // Show loading state
    queryBtn.disabled = true;
    queryBtn.innerHTML = '<span class="loading"></span> Searching...';

    // Switch to results section
    switchSection('results');
    resultsContainer.innerHTML = '<div class="status info"><span class="loading"></span> Searching knowledge base...</div>';

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
            resultsContainer.innerHTML = '<div class="empty-state">No relevant documents found. Try uploading some documents first.</div>';
            updateCounter('results-counter', '0 results');
        } else {
            updateCounter('results-counter', `${data.results.length} results`);
            resultsContainer.innerHTML = data.results.map((result, index) => `
                <div class="result-item">
                    <div class="result-header">
                        <span class="result-source">${escapeHtml(result.filename)} · Chunk ${result.chunk_index + 1}</span>
                        <span class="result-score">
                            <span class="result-score-text">score:\u00A0\u00A0</span>
                            ${result.similarity.toFixed(4)}
                        </span>
                    </div>
                    <div class="result-content">${escapeHtml(result.content)}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        resultsContainer.innerHTML = `<div class="status error">Query failed: ${escapeHtml(error.message)}</div>`;
    } finally {
        queryBtn.disabled = false;
        queryBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Search`;
    }
}

// ===== Helpers =====
function updateCounter(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Keyboard shortcut: Ctrl+Enter to search
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        const queryInput = document.getElementById('query-input');
        if (queryInput && document.activeElement === queryInput) {
            queryDocuments();
        }
    }
});