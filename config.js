window.CONFIG = window.CONFIG || {};

// Initialize config with default values
Object.assign(window.CONFIG, {
    WORKER_URL: null,

    // API endpoints
    ENDPOINTS: {
        PROCESS: '/',
        PROXY: '/?url='
    },
    
    // Supported file types
    SUPPORTED_TYPES: [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/webp',
        'image/avif'
    ],
    
    // File size limits (in bytes)
    MAX_FILE_SIZE: 32 * 1024 * 1024, // 32MB
    
    // Default settings
    DEFAULTS: {
        API_KEY: 'API_KEY_1',
        OPERATION: 'compress',
        RESIZE_METHOD: 'fit',
        CONVERT_FORMAT: 'image/webp',
        BACKGROUND_COLOR: '#ffffff'
    }
});

// Function to initialize worker URL dynamically
window.CONFIG.initializeWorkerUrl = async function() {
    if (window.CONFIG.WORKER_URL) {
        return window.CONFIG.WORKER_URL;
    }

    try {
        // For localhost development, use local worker
        if (window.location.hostname === 'localhost') {
            window.CONFIG.WORKER_URL = 'http://localhost:8787';
            return window.CONFIG.WORKER_URL;
        }

        // For production, try to get URL from worker's config endpoint
        const response = await fetch('/config');
        if (response.ok) {
            const config = await response.json();
            window.CONFIG.WORKER_URL = config.workerUrl;
            return window.CONFIG.WORKER_URL;
        }
    } catch (error) {
        console.warn('Failed to fetch worker URL from config endpoint:', error);
    }

    // Fallback: construct URL from current location
    window.CONFIG.WORKER_URL = window.location.origin;
    return window.CONFIG.WORKER_URL;
};