// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Global variables
let currentOperation = 'compress';
let processingQueue = [];
let completedResults = [];
let isProcessingFiles = false;

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

    // Verify critical elements exist
    if (!uploadZone || !fileInput || !apiKeySelect) {
        console.error("Critical DOM elements not found");
        return;
    }

    // Initialize event listeners - API key setup must come first
    setupApiKeySelection();
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
                // Auto theme - apply system preference immediately
                const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (prefersDark) {
                    body.setAttribute('data-theme', 'auto-dark');
                } else {
                    body.setAttribute('data-theme', 'auto-light');
                }
                icon.className = 'fas fa-adjust';
            }
        }

        // Listen for system theme changes when in auto mode
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                if (themeSelect.value === 'auto') {
                    // Update auto theme based on system preference
                    if (e.matches) {
                        body.setAttribute('data-theme', 'auto-dark');
                    } else {
                        body.setAttribute('data-theme', 'auto-light');
                    }
                }
            });
        }
    }

    function setupApiKeySelection() {
        // Load saved API key or default to API_KEY_1
        const savedApiKey = localStorage.getItem('selectedApiKey') || 'API_KEY_1';

        // Ensure the select element has the correct value
        if (apiKeySelect) {
            apiKeySelect.value = savedApiKey;

            // If the value didn't set properly, try setting it to the first available option
            if (!apiKeySelect.value && apiKeySelect.options.length > 0) {
                apiKeySelect.value = apiKeySelect.options[0].value;
            }
        }

        // Save API key selection when changed
        apiKeySelect.addEventListener('change', (e) => {
            localStorage.setItem('selectedApiKey', e.target.value);
        });
    }

    function setupUploadZone() {
        uploadZone.addEventListener("click", (e) => {
            // Only trigger file input click if we didn't click directly on the file input
            if (e.target !== fileInput) {
                e.preventDefault();
                fileInput.click();
            }
        });

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

            if (files.length > 0 && !isProcessingFiles) {
                handleFiles(files);
            }
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

        // Prevent double processing
        if (isProcessingFiles) {
            return;
        }

        // Validate files
        const errors = validateFiles(files);
        if (errors.length > 0) {
            alert("File validation errors:\n" + errors.join("\n"));
            return;
        }

        // Validate API key with fallback
        let apiKey = apiKeySelect.value;

        // If no API key is selected, try to set a default
        if (!apiKey || apiKey.trim() === '') {
            // Try to set the first available option
            if (apiKeySelect.options.length > 0) {
                apiKeySelect.value = apiKeySelect.options[0].value;
                apiKey = apiKeySelect.value;
            }

            // If still no API key, show error
            if (!apiKey || apiKey.trim() === '') {
                alert("Please select an API key before uploading files.");
                return;
            }
        }

        // Set processing flag
        isProcessingFiles = true;

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

        // Reset file input to allow selecting the same files again
        // Do this after a small delay to avoid potential race conditions
        setTimeout(() => {
            fileInput.value = '';
            isProcessingFiles = false; // Reset processing flag
        }, 100);
    }

    function addQueueItemToDOM(queueItem) {
        const queueItems = document.getElementById("queue-items");
        const queueItemEl = document.createElement("div");
        queueItemEl.className = "queue-item";
        queueItemEl.id = `queue-item-${queueItem.id}`;

        // Create thumbnail URL for the original file
        const thumbnailUrl = URL.createObjectURL(queueItem.file);
        const fileSize = formatFileSize(queueItem.file.size);
        const fileFormat = queueItem.file.type.split('/')[1].toUpperCase();

        queueItemEl.innerHTML = `
            <div class="queue-item-thumbnail">
                <img src="${thumbnailUrl}" alt="${queueItem.file.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <i class="fas fa-image" style="display: none;"></i>
            </div>
            <div class="queue-item-content">
                <div class="queue-item-header">
                    <div class="queue-item-info">
                        <div class="queue-item-name">${queueItem.file.name}</div>
                        <div class="queue-item-details">
                            <span class="queue-item-format">${fileFormat}</span>
                            <span class="queue-item-size">${fileSize}</span>
                        </div>
                    </div>
                    <div class="queue-item-status">Optimizing...</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>
            <div class="queue-item-actions">
                <!-- Actions will be added when completed -->
            </div>
        `;

        queueItems.appendChild(queueItemEl);
    }

    function updateQueueItem(queueItem) {
        const queueItemEl = document.getElementById(`queue-item-${queueItem.id}`);
        if (!queueItemEl) return;

        const statusEl = queueItemEl.querySelector(".queue-item-status");
        const progressFill = queueItemEl.querySelector(".progress-fill");
        const progressBar = queueItemEl.querySelector(".progress-bar");
        const actionsEl = queueItemEl.querySelector(".queue-item-actions");

        // Update progress
        progressFill.style.width = `${queueItem.progress}%`;

        // Remove all animation and status classes first
        progressFill.classList.remove('processing', 'completed');
        progressBar.classList.remove('queued');
        queueItemEl.classList.remove('completed', 'error', 'processing');

        if (queueItem.status === 'queued' && queueItem.progress === 0) {
            statusEl.textContent = 'Waiting...';
            progressBar.classList.add('queued');
        } else if (queueItem.status === 'Processing') {
            statusEl.textContent = 'Optimizing...';
            queueItemEl.classList.add('processing');
            if (queueItem.progress > 0 && queueItem.progress < 100) {
                progressFill.classList.add('processing');
            }
        } else if (queueItem.status === 'Completed' && queueItem.result) {
            queueItemEl.classList.add('completed');
            progressFill.classList.add('completed');

            // Calculate compression ratio
            const compressionRatio = ((1 - queueItem.result.processedSize / queueItem.result.originalSize) * 100).toFixed(0);
            const processedSize = formatFileSize(queueItem.result.processedSize);

            // Update status to show compression results prominently
            statusEl.innerHTML = `
                <div class="compression-result">
                    <span class="compression-percentage">-${compressionRatio}%</span>
                    <span class="compressed-size">${processedSize}</span>
                </div>
            `;

            // Add download button
            actionsEl.innerHTML = `
                <button class="btn btn-primary btn-small" onclick="downloadFile('${queueItem.result.url}', '${getProcessedFileName(queueItem.file.name)}')">
                    <i class="fas fa-download"></i>
                </button>
            `;
        } else if (queueItem.status === 'error') {
            queueItemEl.classList.add('error');
            statusEl.textContent = 'Failed';
            actionsEl.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="color: var(--error);"></i>
            `;
        }

        // Update overall progress
        updateOverallProgress();
    }

    function updateOverallProgress() {
        const totalItems = processingQueue.length;
        const completedItems = processingQueue.filter(item => item.status === 'Completed').length;
        const processingItems = processingQueue.filter(item => item.status === 'Processing').length;

        const queueTitle = document.getElementById('queue-title');
        const queueDescription = document.getElementById('queue-description');
        const overallProgress = document.getElementById('overall-progress');
        const queueFooter = document.getElementById('queue-footer');

        if (totalItems === 0) return;

        const progressPercentage = Math.round((completedItems / totalItems) * 100);
        overallProgress.textContent = `${progressPercentage}%`;

        if (completedItems === totalItems) {
            queueTitle.textContent = 'All done!';
            queueTitle.style.color = '#28a745';
            queueDescription.textContent = 'Your images have been successfully optimized. You can now download them individually or all at once.';
            queueFooter.style.display = 'block';
        } else if (processingItems > 0) {
            queueTitle.textContent = `Just a minute... (${completedItems + processingItems}/${totalItems})`;
            queueTitle.style.color = '#9ACD32';
            queueDescription.textContent = 'Your images are being optimized right now. Please give us a moment to finish getting the best results for you.';
        } else {
            queueTitle.textContent = `Processing... (${completedItems}/${totalItems})`;
            queueTitle.style.color = '#667eea';
            queueDescription.textContent = 'Your images are in the queue and will be processed shortly.';
        }
    }
    async function processQueue() {
        const activeItems = processingQueue.filter(item => item.status === 'queued');

        for (const queueItem of activeItems) {
            queueItem.status = 'Processing';
            queueItem.progress = 10;
            updateQueueItem(queueItem);

            try {
                const result = await processFile(queueItem.file, queueItem);
                queueItem.status = 'Completed';
                queueItem.progress = 100;
                queueItem.result = result;
                updateQueueItem(queueItem);

                // Add to completed results
                completedResults.push(queueItem);

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
        const response = await fetch(window.CONFIG.WORKER_URL, {
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
                const imageResponse = await fetch(`${window.CONFIG.WORKER_URL}${window.CONFIG.ENDPOINTS.PROXY}${encodeURIComponent(data.location)}`);
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

        // Hide container
        document.getElementById("processing-queue").style.display = "none";

        // Reset file input
        fileInput.value = "";
    }
}

// Global functions for onclick handlers
function downloadFile(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
}
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

    const closeModal = () => {
        if (modal && modal.parentNode === document.body) {
            document.body.removeChild(modal);
        }
    };
    modal.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
    });
}