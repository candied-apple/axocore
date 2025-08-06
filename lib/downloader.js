// Handles downloading Minecraft client, libraries, and assets
// No need for axios; use built-in fetch
const fs = require('fs');
const path = require('path');

async function downloadFile(url, dest, showProgress = true) {
  const writer = fs.createWriteStream(dest);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  const totalLength = parseInt(res.headers.get('content-length') || '0');
  let downloaded = 0;
  let startTime = Date.now();
  let lastTime = startTime;
  let lastDownloaded = 0;
  const fileName = path.basename(dest);
  if (showProgress && totalLength) {
    process.stdout.write(`Downloading ${fileName}...\n`);
  }
  return new Promise(async (resolve, reject) => {
    try {
      for await (const chunk of res.body) {
        writer.write(chunk);
        downloaded += chunk.length;
        if (showProgress && totalLength) {
          const now = Date.now();
          if (now - lastTime > 200) { // update every 200ms
            const percent = (downloaded / totalLength) * 100;
            const mbps = ((downloaded - lastDownloaded) / 1048576) / ((now - lastTime) / 1000);
            lastTime = now;
            lastDownloaded = downloaded;
            if (process.stdout.isTTY && typeof process.stdout.clearLine === 'function' && typeof process.stdout.cursorTo === 'function') {
              process.stdout.clearLine(0);
              process.stdout.cursorTo(0);
            }
            process.stdout.write(
              `${fileName} | ${(percent).toFixed(2)}% | ${(downloaded/1048576).toFixed(2)}MB / ${(totalLength/1048576).toFixed(2)}MB | ${(mbps).toFixed(2)} MB/s`
            );
          }
        }
      }
      writer.end();
      writer.on('finish', () => {
        if (showProgress && totalLength) {
          if (process.stdout.isTTY && typeof process.stdout.clearLine === 'function' && typeof process.stdout.cursorTo === 'function') {
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
          }
          process.stdout.write(
            `${fileName} | 100.00% | ${(totalLength/1048576).toFixed(2)}MB / ${(totalLength/1048576).toFixed(2)}MB | Done\n`
          );
        }
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
