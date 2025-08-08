// Main Minecraft logic: download manifest, client, libraries, assets, and launch offline
const path = require('path');
const fs = require('fs');
const { downloadFile } = require('./downloader');

const MINECRAFT_VERSION = '1.20.1';
const MINECRAFT_MANIFEST = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';

async function getVersionManifest() {
  const res = await fetch(MINECRAFT_MANIFEST);
  if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status} ${res.statusText}`);
  return await res.json();
}

async function getVersionInfo(version) {
  const manifest = await getVersionManifest();
  const versionObj = manifest.versions.find(v => v.id === version);
  if (!versionObj) throw new Error('Version not found');
  const res = await fetch(versionObj.url);
  if (!res.ok) throw new Error(`Failed to fetch version info: ${res.status} ${res.statusText}`);
  return await res.json();
}

const crypto = require('crypto');

function fileHashSync(filePath, algo = 'sha1') {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash(algo);
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

async function downloadClientJar(version, versionsDir, progressCb) {
  const info = await getVersionInfo(version);
  // Download client jar
  const clientJarPath = path.join(versionsDir, `${version}.jar`);
  fs.mkdirSync(versionsDir, { recursive: true });
  let needDownload = true;
  if (fs.existsSync(clientJarPath) && info.downloads.client.sha1) {
    const hash = fileHashSync(clientJarPath, 'sha1');
    if (hash === info.downloads.client.sha1) needDownload = false;
  }
  let fileBytesDownloaded = fs.existsSync(clientJarPath) && info.downloads.client.size ? info.downloads.client.size : 0;
  let fileTotalBytes = info.downloads.client.size;
  let cumulativeBytes = 0;
  let totalBytes = fileTotalBytes;
  if (needDownload) {
    if (progressCb) progressCb({ type: 'client', file: clientJarPath, fileBytesDownloaded, fileTotalBytes, cumulativeBytes, totalBytes });
    await downloadFile(info.downloads.client.url, clientJarPath, {
      expectedSize: fileTotalBytes,
      onProgress: ({ downloadedBytes, totalBytes: tb }) => {
        fileBytesDownloaded = downloadedBytes;
        fileTotalBytes = tb;
        if (progressCb) progressCb({
          type: 'client',
          file: clientJarPath,
          fileBytesDownloaded,
          fileTotalBytes,
          cumulativeBytes: fileBytesDownloaded,
          totalBytes
        });
      }
    });
    cumulativeBytes = fileTotalBytes;
  } else {
    cumulativeBytes = fileTotalBytes;
    if (progressCb) progressCb({ type: 'client', file: clientJarPath, fileBytesDownloaded, fileTotalBytes, cumulativeBytes, totalBytes });
  }
  // Download version JSON
  const versionJsonPath = path.join(versionsDir, `${version}.json`);
  fs.writeFileSync(versionJsonPath, JSON.stringify(info, null, 2));
  return clientJarPath;
}


async function downloadLibraries(version, rootDir, progressCb) {
  const info = await getVersionInfo(version);
  const libs = info.libraries.filter(l => l.downloads && l.downloads.artifact);
  const libPaths = [];
  let idx = 0;
  // Calculate total bytes for all libraries
  let totalBytes = libs.reduce((sum, lib) => sum + (lib.downloads.artifact.size || 0), 0);
  let cumulativeBytes = 0;
  for (const lib of libs) {
    idx++;
    const url = lib.downloads.artifact.url;
    const relPath = lib.downloads.artifact.path.replace(/\\/g, '/');
    const libPath = path.join(rootDir, 'libraries', ...relPath.split('/'));
    fs.mkdirSync(path.dirname(libPath), { recursive: true });
    let needDownload = true;
    if (fs.existsSync(libPath) && lib.downloads.artifact.sha1) {
      const hash = fileHashSync(libPath, 'sha1');
      if (hash === lib.downloads.artifact.sha1) needDownload = false;
    }
    const fileTotalBytes = lib.downloads.artifact.size || 0;
    let fileBytesDownloaded = needDownload ? 0 : fileTotalBytes;
    if (progressCb) progressCb({
      type: 'library',
      file: libPath,
      index: idx,
      total: libs.length,
      fileBytesDownloaded,
      fileTotalBytes,
      cumulativeBytes: cumulativeBytes + fileBytesDownloaded,
      totalBytes
    });
    if (needDownload) {
      await require('./downloader').downloadFile(url, libPath, {
        expectedSize: fileTotalBytes,
        onProgress: ({ downloadedBytes }) => {
          fileBytesDownloaded = downloadedBytes;
          if (progressCb) progressCb({
            type: 'library',
            file: libPath,
            index: idx,
            total: libs.length,
            fileBytesDownloaded,
            fileTotalBytes,
            cumulativeBytes: cumulativeBytes + fileBytesDownloaded,
            totalBytes
          });
        }
      });
      cumulativeBytes += fileTotalBytes;
    } else {
      cumulativeBytes += fileTotalBytes;
    }
    libPaths.push(libPath);
  }
  return libPaths;
}

async function downloadAssets(version, destDir, progressCb) {
  const info = await getVersionInfo(version);
  const assetIndexUrl = info.assetIndex.url;
  const assetIndexPath = path.join(destDir, 'assets', 'indexes', `${version}.json`);
  fs.mkdirSync(path.dirname(assetIndexPath), { recursive: true });
  if (!fs.existsSync(assetIndexPath)) {
    if (progressCb) progressCb({ type: 'assetIndex', file: assetIndexPath });
    await require('./downloader').downloadFile(assetIndexUrl, assetIndexPath);
  }
  const assetIndex = JSON.parse(fs.readFileSync(assetIndexPath));
  const objects = assetIndex.objects;
  const assetObjectsDir = path.join(destDir, 'assets', 'objects');
  let idx = 0;
  const total = Object.keys(objects).length;
  // Efficient cumulative byte tracking
  let totalBytes = 0;
  for (const obj of Object.values(objects)) {
    totalBytes += obj.size || 0;
  }
  let cumulativeBytes = 0;
  const assetEntries = Object.entries(objects);
  const concurrency = 12; // You can tune this value (8-16 is typical)
  let active = 0;
  let nextIndex = 0;
  let finished = 0;
  let assetProgress = new Array(assetEntries.length).fill(0);

  function updateCumulative() {
    // Sum all completed bytes so far
    return assetProgress.reduce((a, b) => a + b, 0);
  }

  return await new Promise((resolve, reject) => {
    function startNext() {
      if (nextIndex >= assetEntries.length) {
        if (active === 0) resolve(assetIndexPath);
        return;
      }
      const myIdx = nextIndex++;
      active++;
      const [name, obj] = assetEntries[myIdx];
      const hash = obj.hash;
      const subdir = hash.substring(0, 2);
      const assetPath = path.join(assetObjectsDir, subdir, hash);
      let needDownload = true;
      if (fs.existsSync(assetPath)) {
        const fileHash = fileHashSync(assetPath, 'sha1');
        if (fileHash === hash) needDownload = false;
      }
      const fileTotalBytes = obj.size || 0;
      let fileBytesDownloaded = needDownload ? 0 : fileTotalBytes;
      // Always call progressCb for every asset, even if skipped
      assetProgress[myIdx] = fileBytesDownloaded;
      if (progressCb) progressCb({
        type: 'asset',
        file: assetPath,
        index: myIdx + 1,
        total,
        fileBytesDownloaded,
        fileTotalBytes,
        cumulativeBytes: updateCumulative(),
        totalBytes
      });
      if (!needDownload) {
        finished++;
        active--;
        if (finished === assetEntries.length) resolve(assetIndexPath);
        else startNext();
        return;
      }
      fs.mkdirSync(path.dirname(assetPath), { recursive: true });
      const url = `https://resources.download.minecraft.net/${subdir}/${hash}`;
      require('./downloader').downloadFile(url, assetPath, {
        expectedSize: fileTotalBytes,
        onProgress: ({ downloadedBytes }) => {
          fileBytesDownloaded = downloadedBytes;
          assetProgress[myIdx] = fileBytesDownloaded;
          if (progressCb) progressCb({
            type: 'asset',
            file: assetPath,
            index: myIdx + 1,
            total,
            fileBytesDownloaded,
            fileTotalBytes,
            cumulativeBytes: updateCumulative(),
            totalBytes
          });
        }
      }).then(() => {
        assetProgress[myIdx] = fileTotalBytes;
        finished++;
        active--;
        if (finished === assetEntries.length) resolve(assetIndexPath);
        else startNext();
      }).catch(reject);
    }
    // Start initial batch
    for (let i = 0; i < concurrency && i < assetEntries.length; i++) {
      startNext();
    }
  });
}

module.exports = {
  getVersionManifest,
  getVersionInfo,
  downloadClientJar,
  downloadLibraries,
  downloadAssets,
  MINECRAFT_VERSION
};
