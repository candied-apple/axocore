const fs = require('fs');

async function downloadFile(url, dest, showProgress = true) {
  const writer = fs.createWriteStream(dest);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  return new Promise(async (resolve, reject) => {
    try {
      for await (const chunk of res.body) {
        writer.write(chunk);
        // ...existing code...
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
