function getDefaultMinecraftDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), '.minecraft');
  } else if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'minecraft');
  } else {
    return path.join(home, '.minecraft');
  }
}
// Core API for axocore

const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const emitter = new EventEmitter();
const minecraft = require('./minecraft');
const { launchMinecraft, launchFabric } = require('./launcher');


async function downloadAll({ version = minecraft.MINECRAFT_VERSION, destDir, onDownloadProgress }) {
  // Create Minecraft-like folder structure
  const folders = [
    'assets',
    'versions',
    'saves',
    'mods',
    'resourcepacks',
    'logs',
    'crash-reports'
  ];
  for (const folder of folders) {
    fs.mkdirSync(path.join(destDir, folder), { recursive: true });
  }
  // Touch config files if not exist, with plausible content
  const optionsPath = path.join(destDir, 'options.txt');
  if (!fs.existsSync(optionsPath)) fs.writeFileSync(optionsPath, '# Minecraft options\n');

  const serversPath = path.join(destDir, 'servers.dat');
  if (!fs.existsSync(serversPath)) fs.writeFileSync(serversPath, '');

  const launcherProfilesPath = path.join(destDir, 'launcher_profiles.json');
  if (!fs.existsSync(launcherProfilesPath)) {
    const defaultProfiles = {
      profiles: {},
      selectedProfile: '',
      clientToken: '',
      authenticationDatabase: {},
      launcherVersion: {
        name: "2.8.2",
        format: 21
      },
      settings: {
        crashAssistance: true,
        enableAdvanced: false,
        keepLauncherOpen: false,
        showGameLog: false,
        allowTelemetry: false
      }
    };
    fs.writeFileSync(launcherProfilesPath, JSON.stringify(defaultProfiles, null, 2));
  }

  // Progress tracking
  let fileCount = 0, fileTotal = 0, filesDownloaded = 0, filesSkipped = 0;
  const progressCb = (info) => {
    fileCount++;
    emitter.emit('downloadProgress', info);
    if (typeof onDownloadProgress === 'function') {
      onDownloadProgress(info);
    }
    let msg = '';
    if (info.type === 'client') {
      msg = `[${fileCount}] Downloading Minecraft client: ${path.basename(info.file)}`;
    } else if (info.type === 'library') {
      msg = `[${fileCount}] Downloading library ${info.index}/${info.total}: ${path.basename(info.file)}`;
    } else if (info.type === 'assetIndex') {
      msg = `[${fileCount}] Downloading asset index: ${path.basename(info.file)}`;
    } else if (info.type === 'asset') {
      // For assets, info.file is the hash, so just show the hash
      msg = `[${fileCount}] Downloading asset ${info.index}/${info.total}`;
    }
    // No direct logging; rely on events only
  };

  // Download client jar to versions folder
  const versionsDir = path.join(destDir, 'versions', version);
  fs.mkdirSync(versionsDir, { recursive: true });
  const clientJar = await minecraft.downloadClientJar(version, versionsDir, progressCb);
  // Download libraries (to root destDir/libraries)
  const libraries = await minecraft.downloadLibraries(version, destDir, progressCb);
  // Download assets (to root destDir/assets)
  const assetIndexPath = await minecraft.downloadAssets(version, destDir, progressCb);
  const assetsDir = path.join(destDir, 'assets');
  // Print summary
  // (For now, just print total files attempted)
  console.log('Download/check complete.');
  return { clientJar, libraries, assetsDir, assetIndexPath };
}



const { getOfflineUUID } = require('./uuid');
const { authenticate } = require('./auth');


/**
 * Launch Minecraft with support for offline or Yggdrasil authentication.
 * @param {Object} opts
 * @param {string} opts.javaPath
 * @param {string} opts.clientJar
 * @param {string[]} opts.libraries
 * @param {string} opts.assetsDir
 * @param {string} opts.username
 * @param {string} opts.gameDir
 * @param {string} opts.version
 * @param {string} [opts.password] - If provided, will use Yggdrasil auth
 * @param {string} [opts.authServer] - Custom Yggdrasil server URL
 * @param {string[]} [opts.javaArgs] - Custom Java arguments (e.g. ["-Xmx2G"])
 */

/**
 * Launch Minecraft (vanilla or modded) with support for offline or Yggdrasil authentication.
 * @param {Object} opts
 * @param {string} opts.javaPath
 * @param {string} opts.username
 * @param {string} [opts.password]
 * @param {string} [opts.authServer]
 * @param {string} opts.gameDir
 * @param {string} opts.destDir
 * @param {string} opts.version - Minecraft version
 * @param {string} [opts.modLoader] - 'vanilla' (default) or 'fabric'
 * @param {string} [opts.fabricVersion] - Required if modLoader is 'fabric'
 * @param {string[]} [opts.javaArgs]
 */
async function launch({
  javaPath,
  username = 'Player',
  password,
  authServer,
  gameDir,
  destDir,
  version,
  modLoader = 'vanilla',
  fabricVersion,
  javaArgs = [],
  onDownloadProgress,
  onGameLog
}) {
  // Set default dirs if not provided
  const resolvedDestDir = destDir || getDefaultMinecraftDir();
  const resolvedGameDir = gameDir || resolvedDestDir;

  // Authenticate first
  let uuid = '0', accessToken = '0', userType = 'offline';
  if (password) {
    const auth = await authenticate({ username, password, authServer });
    uuid = auth.selectedProfile.id;
    accessToken = auth.accessToken;
    userType = 'mojang';
  }

  // Download all required files
  const { clientJar, libraries, assetsDir } = await downloadAll({ version, destDir: resolvedDestDir, onDownloadProgress });

  // Launch the game
  if (modLoader === 'fabric') {
    if (!fabricVersion) throw new Error('fabricVersion must be specified when modLoader is "fabric"');
    // Parse Fabric version JSON
    const fabricJsonPath = path.join(resolvedDestDir, 'versions', fabricVersion, `${fabricVersion}.json`);
    const fabricJson = JSON.parse(fs.readFileSync(fabricJsonPath, 'utf8'));
    // Collect all library JARs (Fabric + MC)
    const mcJsonPath = path.join(resolvedDestDir, 'versions', version, `${version}.json`);
    const mcJson = JSON.parse(fs.readFileSync(mcJsonPath, 'utf8'));
    function resolveLibs(libs) {
      return libs.map(lib => {
        if (lib.downloads && lib.downloads.artifact && lib.downloads.artifact.path) {
          return path.join(resolvedDestDir, 'libraries', lib.downloads.artifact.path);
        }
        // Fabric-style: only name/url, must convert to path
        if (lib.name) {
          const parts = lib.name.split(':');
          if (parts.length >= 3) {
            const group = parts[0].replace(/\./g, '/');
            const artifact = parts[1];
            const v = parts[2];
            return path.join(resolvedDestDir, 'libraries', group, artifact, v, `${artifact}-${v}.jar`);
          }
        }
        return null;
      }).filter(Boolean);
    }
    const fabricLibs = resolveLibs(fabricJson.libraries);
    const mcLibs = resolveLibs(mcJson.libraries);
    // Add Minecraft client JAR to the classpath
    const allLibs = Array.from(new Set([...fabricLibs, ...mcLibs, clientJar]));
    // Find Fabric loader JAR (the one with fabric-loader in its name)
    const fabricLoaderLib = fabricJson.libraries.find(lib => lib.name && lib.name.startsWith('net.fabricmc:fabric-loader:'));
    let fabricLoaderJar = null;
    if (fabricLoaderLib) {
      const parts = fabricLoaderLib.name.split(':');
      if (parts.length === 3) {
        const group = parts[0].replace(/\./g, '/');
        const artifact = parts[1];
        const v = parts[2];
        fabricLoaderJar = path.join(resolvedDestDir, 'libraries', group, artifact, v, `${artifact}-${v}.jar`);
      }
    }
    if (!fabricLoaderJar) throw new Error('Fabric loader JAR not found!');
    return launchFabric({
      javaPath,
      fabricLoaderJar,
      libraries: allLibs,
      assetsDir,
      username,
      gameDir: resolvedGameDir,
      version,
      uuid,
      accessToken,
      userType,
      javaArgs,
      onGameLog
    });
  } else {
    // Vanilla
    return launchMinecraft({
      javaPath,
      clientJar,
      libraries,
      assetsDir,
      username,
      gameDir: resolvedGameDir,
      version,
      uuid,
      accessToken,
      userType,
      javaArgs,
      onGameLog
    });
  }
}



module.exports = {
  downloadAll,
  launch,
  authenticate,
  emitter
};
