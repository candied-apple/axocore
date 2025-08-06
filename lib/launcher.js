// Launch Minecraft in offline mode
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function getLogFilePath(gameDir) {
  // Create logs directory within the game directory
  const logsDir = path.join(gameDir, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  return path.join(logsDir, 'latest.log');
}

function getCrashReportPath(gameDir) {
  // Create crash-reports directory within the game directory
  const crashDir = path.join(gameDir, 'crash-reports');
  fs.mkdirSync(crashDir, { recursive: true });
  const date = new Date();
  const name = `crash-${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}.${String(date.getMinutes()).padStart(2,'0')}.${String(date.getSeconds()).padStart(2,'0')}-client.txt`;
  return path.join(crashDir, name);
}

function launchMinecraft({
  javaPath,
  clientJar,
  libraries,
  assetsDir,
  username = 'Player',
  gameDir,
  version,
  uuid = '0',
  accessToken = '0',
  userType = 'offline',
  javaArgs = []
}) {
  const classpath = [
    ...libraries,
    clientJar
  ].join(path.delimiter);

  const args = [
    ...javaArgs,
    '-cp', classpath,
    'net.minecraft.client.main.Main',
    '--username', username,
    '--version', version,
    '--gameDir', gameDir,
    '--assetsDir', assetsDir,
    '--assetIndex', version,
    '--uuid', uuid,
    '--accessToken', accessToken,
    '--userType', userType
  ];

  // Logging
  const logFile = getLogFilePath(gameDir);
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  // Crash report
  let crashed = false;
  let crashReportPath = null;

  // Set cwd to the gameDir (mcdata) so all files are generated inside mcdata
  const child = spawn(javaPath, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: gameDir });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  child.on('error', (err) => {
    crashed = true;
    crashReportPath = getCrashReportPath(gameDir);
    fs.writeFileSync(crashReportPath, `Launcher failed to start Minecraft:\n${err.stack || err}`);
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      crashed = true;
      crashReportPath = getCrashReportPath(gameDir);
      fs.appendFileSync(crashReportPath, `Minecraft exited with code ${code}. See logs for details.\n`);
    }
  });

  // Also print logs to console
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  return child;
}


/**
 * Launch Minecraft with the Fabric mod loader.
 * @param {Object} options - Launch options
 * @param {string} options.javaPath - Path to Java executable
 * @param {string} options.fabricLoaderJar - Path to Fabric loader JAR
 * @param {string[]} options.libraries - Array of library JAR paths (including Fabric and MC libraries)
 * @param {string} options.assetsDir - Path to assets directory
 * @param {string} [options.username] - Player username
 * @param {string} options.gameDir - Path to game directory
 * @param {string} options.version - Minecraft version
 * @param {string} [options.uuid] - Player UUID
 * @param {string} [options.accessToken] - Access token
 * @param {string} [options.userType] - User type
 * @param {string[]} [options.javaArgs] - Extra JVM arguments
 */
function launchFabric({
  javaPath,
  fabricLoaderJar,
  libraries,
  assetsDir,
  username = 'Player',
  gameDir,
  version,
  uuid = '0',
  accessToken = '0',
  userType = 'offline',
  javaArgs = []
}) {
  // Fabric requires its loader JAR as the main entry point
  const classpath = [
    ...libraries,
    fabricLoaderJar
  ].join(path.delimiter);

  const args = [
    ...javaArgs,
    '-cp', classpath,
    // Fabric's main class:
    'net.fabricmc.loader.impl.launch.knot.KnotClient',
    '--username', username,
    '--version', version,
    '--gameDir', gameDir,
    '--assetsDir', assetsDir,
    '--assetIndex', version,
    '--uuid', uuid,
    '--accessToken', accessToken,
    '--userType', userType
  ];

  // Logging
  const logFile = getLogFilePath(gameDir);
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  // Crash report
  let crashed = false;
  let crashReportPath = null;

  // Set cwd to the gameDir (mcdata) so all files are generated inside mcdata
  const child = spawn(javaPath, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: gameDir });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  child.on('error', (err) => {
    crashed = true;
    crashReportPath = getCrashReportPath(gameDir);
    fs.writeFileSync(crashReportPath, `Launcher failed to start Fabric:\n${err.stack || err}`);
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      crashed = true;
      crashReportPath = getCrashReportPath(gameDir);
      fs.appendFileSync(crashReportPath, `Fabric exited with code ${code}. See logs for details.\n`);
    }
  });

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  return child;
}

module.exports = { launchMinecraft, launchFabric };
