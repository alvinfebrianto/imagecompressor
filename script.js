// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Global variables
let currentOperation = 'compress';
let processingQueue = [];
let completedResults = [];

function initializeApp() {
    // DOM elements
    const uploadZone = document.getElementById("upload-dropbox-zone");
    const fileInput = document.getElementById("file-input");
    const apiKeySelect = document.getElementById("api-key");
    const operationTabs = document.querySelectorAll(".tab-btn");
    const processingQueueEl = document.getElementById("processing-queue");
    const resultsContainer = document.getElementById("results-container");
    const downloadAllBtn = document.getElementById("download-all");
    const clearResultsBtn = document.getElementById("clear-results");

    // Initialize event listeners
    setupThemeSystem();
    setupUploadZone();
    setupOperationTabs();
    setupConvertFormatChange();
    setupBatchActions();

    function setupThemeSystem() {
        const themeToggle = document.getElementById("theme-toggle");
        const themeSelect = document.getElementById("theme-select");
        const body = document.body;

        // Load saved theme or default to auto
        const savedTheme = localStorage.getItem('theme') || 'auto';
        themeSelect.value = savedTheme;
        applyTheme(savedTheme);

        // Theme toggle button
        themeToggle.addEventListener('click', () => {
            const currentTheme = themeSelect.value;
            let nextTheme;

            if (currentTheme === 'auto') {
                nextTheme = 'light';
            } else if (currentTheme === 'light') {
                nextTheme = 'dark';
            } else {
                nextTheme = 'auto';
            }

            themeSelect.value = nextTheme;
            applyTheme(nextTheme);
            localStorage.setItem('theme', nextTheme);
        });

        // Theme dropdown
        themeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            applyTheme(theme);
            localStorage.setItem('theme', theme);
        });

        function applyTheme(theme) {
            // Remove existing theme attributes
            body.removeAttribute('data-theme');

            // Update toggle button icon
            const icon = themeToggle.querySelector('i');

            if (theme === 'light') {
                body.setAttribute('data-theme', 'light');
                icon.className = 'fas fa-sun';
            } else if (theme === 'dark') {
                body.setAttribute('data-theme', 'dark');
                icon.className = 'fas fa-moon';
            } else {
                // Auto theme - let CSS handle it
                icon.className = 'fas fa-adjust';
            }
        }

        // Listen for system theme changes when in auto mode
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', () => {
                if (themeSelect.value === 'auto') {
                    // Trigger a re-render by temporarily changing theme
                    const currentTheme = body.getAttribute('data-theme');
                    body.setAttribute('data-theme', currentTheme === 'dark' ? 'light' : 'dark');
                    setTimeout(() => body.removeAttribute('data-theme'), 10);
                }
            });
        }
    }

    function setupUploadZone() {
        uploadZone.addEventListener("click", () => fileInput.click());

        uploadZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            uploadZone.classList.add("dragover");
        });

        uploadZone.addEventListener("dragleave", (e) => {
            e.preventDefault();
            uploadZone.classList.remove("dragover");
        });

        uploadZone.addEventListener("drop", (e) => {
            e.preventDefault();
            uploadZone.classList.remove("dragover");
            const files = Array.from(e.dataTransfer.files);
            handleFiles(files);
        });

        fileInput.addEventListener("change", (e) => {
            const files = Array.from(e.target.files);
            handleFiles(files);
        });
    }

    function setupOperationTabs() {
        operationTabs.forEach(tab => {
            tab.addEventListener("click", () => {
                // Update active tab
                operationTabs.forEach(t => t.classList.remove("active"));
                tab.classList.add("active");

                // Update current operation
                currentOperation = tab.dataset.operation;

                // Show/hide relevant options
                document.getElementById("resize-options").style.display =
                    currentOperation === "resize" ? "block" : "none";
                document.getElementById("convert-options").style.display =
                    currentOperation === "convert" ? "block" : "none";
            });
        });
    }

    function setupConvertFormatChange() {
        const convertFormat = document.getElementById("convert-format");
        const backgroundSection = document.getElementById("background-color-section");

        convertFormat.addEventListener("change", (e) => {
            // Show background color option for JPEG (no transparency support)
            backgroundSection.style.display =
                e.target.value === "image/jpeg" ? "block" : "none";
        });
    }

    function setupBatchActions() {
        downloadAllBtn.addEventListener("click", downloadAllResults);
        clearResultsBtn.addEventListener("click", clearAllResults);
    }

    function validateFiles(files) {
        const errors = [];

        files.forEach(file => {
            if (!CONFIG.SUPPORTED_TYPES.includes(file.type)) {
                errors.push(`${file.name}: Unsupported file type`);
            }
            if (file.size > CONFIG.MAX_FILE_SIZE) {
                errors.push(`${file.name}: File too large (max ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB)`);
            }
        });

        return errors;
    }

    function handleFiles(files) {
        if (files.length === 0) return;

        // Validate files
        const errors = validateFiles(files);
        if (errors.length > 0) {
            alert("File validation errors:\n" + errors.join("\n"));
            return;
        }

        // Validate API key
        const apiKey = apiKeySelect.value;
        if (!apiKey) {
            alert("Please select an API key before uploading files.");
            return;
        }

        // Add files to processing queue
        files.forEach(file => {
            const queueItem = {
                id: Date.now() + Math.random(),
                file: file,
                status: 'queued',
                progress: 0,
                result: null,
                error: null
            };
            processingQueue.push(queueItem);
            addQueueItemToDOM(queueItem);
        });

        // Show processing queue
        processingQueueEl.style.display = "block";

        // Start processing
        processQueue();
    }

    function addQueueItemToDOM(queueItem) {
        const queueItems = document.getElementById("queue-items");
        const queueItemEl = document.createElement("div");
        queueItemEl.className = "queue-item";
        queueItemEl.id = `queue-item-${queueItem.id}`;

        queueItemEl.innerHTML = `
            <div class="queue-item-header">
                <span class="queue-item-name">${queueItem.file.name}</span>
                <span class="queue-item-status">Queued</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <div class="progress-text">0%</div>
        `;

        queueItems.appendChild(queueItemEl);
    }

    function updateQueueItem(queueItem) {
        const queueItemEl = document.getElementById(`queue-item-${queueItem.id}`);
        if (!queueItemEl) return;

        const statusEl = queueItemEl.querySelector(".queue-item-status");
        const progressFill = queueItemEl.querySelector(".progress-fill");
        const progressText = queueItemEl.querySelector(".progress-text");

        statusEl.textContent = queueItem.status;
        progressFill.style.width = `${queueItem.progress}%`;
        progressText.textContent = `${queueItem.progress}%`;

        if (queueItem.status === 'completed') {
            queueItemEl.style.borderLeftColor = "#28a745";
        } else if (queueItem.status === 'error') {
            queueItemEl.style.borderLeftColor = "#dc3545";
        }
    }
    async function processQueue() {
        const activeItems = processingQueue.filter(item => item.status === 'queued');

        for (const queueItem of activeItems) {
            queueItem.status = 'processing';
            queueItem.progress = 10;
            updateQueueItem(queueItem);

            try {
                const result = await processFile(queueItem.file, queueItem);
                queueItem.status = 'completed';
                queueItem.progress = 100;
                queueItem.result = result;
                updateQueueItem(queueItem);

                // Add to completed results
                completedResults.push(queueItem);
                addResultToDOM(queueItem);

                // Show results container
                document.getElementById("results-container").style.display = "block";

            } catch (error) {
                queueItem.status = 'error';
                queueItem.progress = 0;
                queueItem.error = error.message;
                updateQueueItem(queueItem);
            }
        }
    }

    async function processFile(file, queueItem) {
        const apiKey = apiKeySelect.value;

        // Update progress
        queueItem.progress = 30;
        updateQueueItem(queueItem);

        // Prepare request payload based on operation
        const payload = {
            operation: currentOperation
        };

        if (currentOperation === 'resize') {
            const method = document.getElementById("resize-method").value;
            const width = parseInt(document.getElementById("resize-width").value);
            const height = parseInt(document.getElementById("resize-height").value);

            if (!width && !height) {
                throw new Error("Please specify width and/or height for resize operation");
            }

            payload.resize = { method };
            if (width) payload.resize.width = width;
            if (height) payload.resize.height = height;
        }

        if (currentOperation === 'convert') {
            const format = document.getElementById("convert-format").value;
            payload.convert = { type: format };

            if (format === 'image/jpeg') {
                const backgroundColor = document.getElementById("background-color").value;
                payload.transform = { background: backgroundColor };
            }
        }

        // Update progress
        queueItem.progress = 50;
        updateQueueItem(queueItem);

        // Prepare request data
        let requestBody, requestHeaders;

        if (currentOperation === 'compress') {
            requestBody = file;
            requestHeaders = {
                "X-API-Key": apiKey,
                "Content-Type": file.type
            };
        } else {
            requestBody = JSON.stringify({
                ...payload,
                fileData: await fileToBase64(file),
                fileName: file.name,
                fileType: file.type
            });
            requestHeaders = {
                "X-API-Key": apiKey,
                "Content-Type": "application/json"
            };
        }

        console.log("Making request:", {
            operation: currentOperation,
            headers: requestHeaders,
            bodyType: typeof requestBody,
            fileSize: file.size,
            fileName: file.name
        });

        // Make request to worker
        const response = await fetch(CONFIG.WORKER_URL, {
            method: "POST",
            headers: requestHeaders,
            body: requestBody
        });

        // Update progress
        queueItem.progress = 80;
        updateQueueItem(queueItem);

        if (!response.ok) {
            let errorMessage = "Processing failed";
            let errorDetails = null;

            try {
                const error = await response.json();
                errorMessage = error.message || error.error || errorMessage;
                errorDetails = error;
                console.error("Server error details:", error);
            } catch (e) {
                errorMessage = response.statusText || errorMessage;
                console.error("Failed to parse error response:", e);
            }

            const fullError = `${errorMessage} (Status: ${response.status})`;
            console.error("Request failed:", {
                status: response.status,
                statusText: response.statusText,
                errorDetails,
                requestInfo: {
                    operation: currentOperation,
                    fileName: file.name,
                    fileSize: file.size
                }
            });

            throw new Error(fullError);
        }

        // Handle different response types
        let result;
        const contentType = response.headers.get("Content-Type");

        if (contentType && contentType.startsWith("image/")) {
            // Direct image response (for resize/convert operations)
            const imageBlob = await response.blob();
            const imageUrl = URL.createObjectURL(imageBlob);

            result = {
                type: 'direct',
                url: imageUrl,
                blob: imageBlob,
                originalSize: file.size,
                processedSize: imageBlob.size,
                width: response.headers.get("Image-Width"),
                height: response.headers.get("Image-Height"),
                contentType: contentType
            };
        } else {
            // JSON response with location (for compress operation)
            const data = await response.json();

            if (data.location) {
                // Fetch the compressed image
                const imageResponse = await fetch(`${CONFIG.WORKER_URL}${CONFIG.ENDPOINTS.PROXY}${encodeURIComponent(data.location)}`);
                const imageBlob = await imageResponse.blob();
                const imageUrl = URL.createObjectURL(imageBlob);

                result = {
                    type: 'location',
                    url: imageUrl,
                    blob: imageBlob,
                    location: data.location,
                    originalSize: file.size,
                    processedSize: imageBlob.size,
                    contentType: imageResponse.headers.get("Content-Type")
                };
            } else {
                throw new Error("Invalid response from server");
            }
        }

        return result;
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
        });
    }

    function addResultToDOM(queueItem) {
        const resultsGrid = document.getElementById("results-grid");
        const result = queueItem.result;

        const compressionRatio = ((1 - result.processedSize / result.originalSize) * 100).toFixed(1);
        const savings = result.originalSize - result.processedSize;

        const resultCard = document.createElement("div");
        resultCard.className = "result-card";
        resultCard.innerHTML = `
            <div class="result-header">
                <i class="fas fa-check-circle result-icon"></i>
                <span class="result-filename">${queueItem.file.name}</span>
            </div>
            <div class="result-stats">
                <div class="stat-item">
                    <div class="stat-label">Original</div>
                    <div class="stat-value">${formatFileSize(result.originalSize)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Processed</div>
                    <div class="stat-value">${formatFileSize(result.processedSize)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Saved</div>
                    <div class="stat-value">${formatFileSize(savings)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Compression</div>
                    <div class="compression-ratio">${compressionRatio}%</div>
                </div>
            </div>
            <div class="result-actions">
                <button class="btn btn-outline btn-small" onclick="previewImage('${result.url}', '${queueItem.file.name}')">
                    <i class="fas fa-eye"></i> Preview
                </button>
                <a href="${result.url}" download="${getProcessedFileName(queueItem.file.name)}" class="btn btn-primary btn-small">
                    <i class="fas fa-download"></i> Download
                </a>
            </div>
        `;

        resultsGrid.appendChild(resultCard);
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function getProcessedFileName(originalName) {
        const lastDot = originalName.lastIndexOf('.');
        const nameWithoutExt = originalName.substring(0, lastDot);
        const ext = originalName.substring(lastDot);

        let suffix = '';
        if (currentOperation === 'resize') suffix = '_resized';
        else if (currentOperation === 'convert') {
            const format = document.getElementById("convert-format").value;
            const newExt = format.split('/')[1];
            return `${nameWithoutExt}_converted.${newExt}`;
        } else {
            suffix = '_compressed';
        }

        return `${nameWithoutExt}${suffix}${ext}`;
    }

    function downloadAllResults() {
        completedResults.forEach(queueItem => {
            const link = document.createElement('a');
            link.href = queueItem.result.url;
            link.download = getProcessedFileName(queueItem.file.name);
            link.click();
        });
    }

    function clearAllResults() {
        // Clear arrays
        processingQueue.length = 0;
        completedResults.length = 0;

        // Clear DOM
        document.getElementById("queue-items").innerHTML = "";
        document.getElementById("results-grid").innerHTML = "";

        // Hide containers
        document.getElementById("processing-queue").style.display = "none";
        document.getElementById("results-container").style.display = "none";

        // Reset file input
        fileInput.value = "";
    }
}

// Global functions for onclick handlers
function previewImage(url, filename) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        cursor: pointer;
    `;

    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
        border-radius: 8px;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: white;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        cursor: pointer;
        font-size: 18px;
    `;

    modal.appendChild(img);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);

    const closeModal = () => document.body.removeChild(modal);
    modal.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
}