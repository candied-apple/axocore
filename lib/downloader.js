// Handles downloading Minecraft client, libraries, and assets
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const extract = require('extract-zip');
const ProgressBar = require('progress');

async function downloadFile(url, dest, showProgress = true) {
  const writer = fs.createWriteStream(dest);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });
  const totalLength = parseInt(response.headers['content-length'] || '0');
  let downloaded = 0;
  let startTime = Date.now();
  let lastTime = startTime;
  let lastDownloaded = 0;
  const fileName = path.basename(dest);
  if (showProgress && totalLength) {
    process.stdout.write(`Downloading ${fileName}...\n`);
  }
  response.data.on('data', (chunk) => {
    downloaded += chunk.length;
    if (showProgress && totalLength) {
      const now = Date.now();
      if (now - lastTime > 200) { // update every 200ms
        const percent = (downloaded / totalLength) * 100;
        const mbps = ((downloaded - lastDownloaded) / 1048576) / ((now - lastTime) / 1000);
        lastTime = now;
        lastDownloaded = downloaded;
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(
          `${fileName} | ${(percent).toFixed(2)}% | ${(downloaded/1048576).toFixed(2)}MB / ${(totalLength/1048576).toFixed(2)}MB | ${(mbps).toFixed(2)} MB/s`
        );
      }
    }
  });
  response.data.on('end', () => {
    if (showProgress && totalLength) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(
        `${fileName} | 100.00% | ${(totalLength/1048576).toFixed(2)}MB / ${(totalLength/1048576).toFixed(2)}MB | Done\n`
      );
    }
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

module.exports = { downloadFile };
