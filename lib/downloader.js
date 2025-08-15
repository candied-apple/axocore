const fs = require('fs');
const axios = require('axios');

async function downloadFile(url, dest, options = {}) {
  // options: { onProgress, expectedSize }
  const writer = fs.createWriteStream(dest);

  const res = await axios.get(url);
  // axios throws on non-2xx, so no need to check res.ok
  const totalBytes = options.expectedSize || (res.headers.get('content-length') ? parseInt(res.headers.get('content-length')) : undefined);
  let downloadedBytes = 0;
  return new Promise(async (resolve, reject) => {
    try {
      for await (const chunk of res.body) {
        writer.write(chunk);
        downloadedBytes += chunk.length;
        if (typeof options.onProgress === 'function') {
          options.onProgress({ downloadedBytes, totalBytes });
        }
      }
      writer.end();
      writer.on('finish', () => {
        resolve();
      });
      writer.on('error', reject);
    } catch (err) {
      writer.destroy();
      reject(err);
    }
  });
}

module.exports = { downloadFile };
