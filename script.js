const dropbox = document.getElementById("upload-dropbox-zone");
const fileInput = dropbox.querySelector("input");
const outputContainer = document.querySelector(".upload__output-container");
const apiKeySelect = document.getElementById("api-key");

dropbox.addEventListener("click", () => {
    fileInput.click();
});

dropbox.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropbox.style.borderColor = "#8CC938";
});

dropbox.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropbox.style.borderColor = "#ccc";
});

dropbox.addEventListener("drop", (e) => {
    e.preventDefault();
    dropbox.style.borderColor = "#ccc";
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        handleFiles(files);
    }
});

fileInput.addEventListener("change", (e) => {
    const files = e.target.files;
    handleFiles(files);
});

function handleFiles(files) {
    outputContainer.innerHTML = ""; // Clear previous results
    for (const file of files) {
        uploadFile(file);
    }
}

async function uploadFile(file) {
    const apiKey = apiKeySelect.value;
    const statusDiv = document.createElement("div");
    statusDiv.textContent = `Uploading ${file.name}...`;
    outputContainer.appendChild(statusDiv);

    try {
        const response = await fetch("https://api.tinify.com/shrink", {
            method: "POST",
            headers: {
                "Authorization": "Basic " + btoa(`api:${apiKey}`)
            },
            body: file
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || "Compression failed");
        }

        const location = response.headers.get("Location");

        // The location URL can be used to download the compressed image.
        // We can also fetch metadata from it.
        const metaResponse = await fetch(location);
        const compressedSize = metaResponse.headers.get('content-length');


        outputContainer.removeChild(statusDiv);

        const resultDiv = document.createElement("div");
        resultDiv.innerHTML = `
            <p>${file.name} (${(file.size / 1024).toFixed(2)} KB) -> Compressed (${(compressedSize / 1024).toFixed(2)} KB)</p>
            <a href="${location}" target="_blank" download="${file.name}">Download</a>
        `;
        outputContainer.appendChild(resultDiv);

    } catch (error) {
        console.error("CORS or network error:", error);
        statusDiv.textContent = `Error compressing ${file.name}: ${error.message}`;
        statusDiv.style.color = "red";
    }
}