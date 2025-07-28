// Configuration file for environment variables
// This file should be ignored in .gitignore for security

const CONFIG = {
    // Worker URL - can be set via environment variable or default
    WORKER_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:8787' // For local development
        : 'https://tinify-proxy.spidaone.workers.dev', // Production
    
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
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}
