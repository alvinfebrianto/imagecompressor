window.CONFIG = window.CONFIG || {};

// Initialize config with default values
Object.assign(window.CONFIG, {
    WORKER_URL: window.location.hostname === 'localhost'
        ? 'http://localhost:8787'
        : 'https://tinify-proxy.spidaone.workers.dev',

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

