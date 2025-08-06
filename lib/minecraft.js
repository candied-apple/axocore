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
  if (needDownload) {
    let fileBytesDownloaded = 0;
    let fileTotalBytes = info.downloads.client.size;
    if (progressCb) progressCb({ type: 'client', file: clientJarPath });
    await downloadFile(info.downloads.client.url, clientJarPath, {
      expectedSize: fileTotalBytes,
      onProgress: ({ downloadedBytes, totalBytes }) => {
        fileBytesDownloaded = downloadedBytes;
        fileTotalBytes = totalBytes;
        if (progressCb) progressCb({
          type: 'client',
          file: clientJarPath,
          fileBytesDownloaded,
          fileTotalBytes
        });
      }
    });
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
    if (needDownload) {
      let fileBytesDownloaded = 0;
      let fileTotalBytes = lib.downloads.artifact.size;
      if (progressCb) progressCb({ type: 'library', file: libPath, index: idx, total: libs.length });
      await require('./downloader').downloadFile(url, libPath, {
        expectedSize: fileTotalBytes,
        onProgress: ({ downloadedBytes, totalBytes }) => {
          fileBytesDownloaded = downloadedBytes;
          fileTotalBytes = totalBytes;
          if (progressCb) progressCb({
            type: 'library',
            file: libPath,
            index: idx,
            total: libs.length,
            fileBytesDownloaded,
            fileTotalBytes
          });
        }
      });
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
  for (const [name, obj] of Object.entries(objects)) {
    idx++;
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
    if (progressCb) progressCb({
      type: 'asset',
      file: assetPath,
      index: idx,
      total,
      fileBytesDownloaded,
      fileTotalBytes,
      cumulativeBytes: cumulativeBytes + fileBytesDownloaded,
      totalBytes
    });
    if (needDownload) {
      fs.mkdirSync(path.dirname(assetPath), { recursive: true });
      const url = `https://resources.download.minecraft.net/${subdir}/${hash}`;
      await require('./downloader').downloadFile(url, assetPath, {
        expectedSize: fileTotalBytes,
        onProgress: ({ downloadedBytes }) => {
          fileBytesDownloaded = downloadedBytes;
          if (progressCb) progressCb({
            type: 'asset',
            file: assetPath,
            index: idx,
            total,
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
  }
  return assetIndexPath;
}

module.exports = {
  getVersionManifest,
  getVersionInfo,
  downloadClientJar,
  downloadLibraries,
  downloadAssets,
  MINECRAFT_VERSION
};
