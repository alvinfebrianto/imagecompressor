const express = require('express');
const multer = require('multer');
const https = require('https');
const path = require('path');

const app = express();
const port = 3000;


// Multer setup for handling file uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve static files from the current directory
app.use(express.static(__dirname));

// Route to handle image compression
app.post('/compress', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    const apiKey = req.body.apiKey;
    if (!apiKey) {
        return res.status(400).json({ message: 'No API key provided.' });
    }

    const options = {
        method: 'POST',
        hostname: 'api.tinify.com',
        path: '/shrink',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64')
        }
    };

    const request = https.request(options, (response) => {
        if (response.statusCode !== 201) {
            let errorData = '';
            response.on('data', chunk => errorData += chunk);
            response.on('end', () => {
                try {
                    const errorResponse = JSON.parse(errorData);
                    return res.status(response.statusCode).json({ message: errorResponse.message || 'Unknown error from Tinify API' });
                } catch (e) {
                    return res.status(response.statusCode).json({ message: 'Failed to parse Tinify error response' });
                }
            });
            return;
        }

        const location = response.headers.location;
        if (!location) {
            return res.status(500).json({ message: 'Tinify API did not return a location header.' });
        }

        // Now we get the metadata from the location URL headers
        https.get(location, (getResult) => {
            getResult.on('data', () => {}); // Consume the data stream but do nothing with it
            getResult.on('end', () => {
                const output = {
                    size: getResult.headers['content-length'],
                    type: getResult.headers['content-type'],
                    url: location
                };
                res.json({ output: output });
            });
        }).on('error', (err) => {
             res.status(500).json({ message: 'Failed to retrieve compressed image metadata.' });
        });
    });

    request.on('error', (error) => {
        res.status(500).json({ message: 'Request to Tinify API failed.' });
    });

    // Write the uploaded image buffer to the request
    request.write(req.file.buffer);
    request.end();
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});