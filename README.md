# axocore

A Node.js library for downloading, installing, and launching Minecraft in offline mode with support for custom authentication servers and mod loaders.

## Features

- **Complete Minecraft Installation**: Downloads all necessary Minecraft files including client JAR, libraries, and assets
- **Offline Mode Support**: Launch Minecraft without requiring official Mojang authentication
- **Custom Authentication**: Support for custom Yggdrasil authentication servers
- **Mod Loader Support**: Built-in support for Fabric mod loader
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Progress Tracking**: Real-time download progress with speed indicators (event-based tracking supported)
- **Live Game Log Tracking**: Listen for game log events in real time using Node.js EventEmitter
- **File Integrity**: SHA1 hash verification for all downloaded files
- **Automatic Directory Structure**: Creates proper Minecraft directory structure

## Installation

```bash
npm install axocore
```

## Quick Start

### Basic Offline Launch

```javascript
const axocore = require('axocore');
const path = require('path');

(async () => {
  await axocore.launch({
    version: '1.20.1',
    username: 'Player',
    javaPath: 'java',
    destDir: path.resolve(__dirname, '.minecraft'),
    gameDir: path.resolve(__dirname, '.minecraft')
  });
})();
```

### Launch with Custom Authentication

```javascript
const axocore = require('axocore');
const path = require('path');

(async () => {
  await axocore.launch({
    version: '1.20.1',
    username: 'your_username',
    password: 'your_password',
    authServer: 'https://your-auth-server.com/api/yggdrasil/authserver',
    javaPath: 'java',
    destDir: path.resolve(__dirname, '.minecraft'),
    gameDir: path.resolve(__dirname, '.minecraft'),
    javaArgs: ['-Xmx2G', '-Xms1G']
  });
})();
```

### Launch with Fabric Mod Loader

```javascript
const axocore = require('axocore');
const path = require('path');

(async () => {
  await axocore.launch({
    modLoader: 'fabric',
    fabricVersion: 'fabric-loader-0.16.14-1.20.1',
    version: '1.20.1',
    username: 'Player',
    javaPath: 'java',
    destDir: path.resolve(__dirname, '.minecraft'),
    gameDir: path.resolve(__dirname, '.minecraft')
  });
})();
```


## API Reference

### Progress and Log Tracking (Simple Callbacks)


You can now track download progress and live game logs by passing callbacks directly to `launch` and `downloadAll`:

- `onDownloadProgress`: Called with info about each file downloaded. For assets, the callback includes:
  - `fileBytesDownloaded`: Bytes downloaded for the current file
  - `fileTotalBytes`: Total bytes for the current file
  - `cumulativeBytes`: Total bytes downloaded so far (all assets)
  - `totalBytes`: Total bytes to download (all assets)
- `onGameLog`: Called with each log line from the running game.

#### Example Usage

```javascript
const axocore = require('axocore');
const path = require('path');

(async () => {
  await axocore.launch({
    version: '1.20.1',
    username: 'Player',
    javaPath: 'java',
    destDir: path.resolve(__dirname, '.minecraft'),
    gameDir: path.resolve(__dirname, '.minecraft'),
    onDownloadProgress: (info) => {
      console.log(info);
    },
    onGameLog: (line) => {
      console.log('[GameLog]', line);
    }
  });
})();
```

### `axocore.launch(options)`

Main function to download and launch Minecraft.

#### Parameters

- `options` (Object) - Launch configuration
  - `version` (string) - Minecraft version (e.g., '1.20.1')
  - `username` (string) - Player username (default: 'Player')
  - `javaPath` (string) - Path to Java executable
  - `destDir` (string) - Directory to download Minecraft files
  - `gameDir` (string) - Game directory for saves, mods, etc.
  - `password` (string, optional) - Password for Yggdrasil authentication
  - `authServer` (string, optional) - Custom authentication server URL
  - `modLoader` (string, optional) - Mod loader type ('vanilla' or 'fabric', default: 'vanilla')
  - `fabricVersion` (string, optional) - Fabric version (required if modLoader is 'fabric')
  - `javaArgs` (Array, optional) - Additional JVM arguments

#### Returns

Returns a child process object for the launched Minecraft instance.

### `axocore.downloadAll(options)`

Downloads all required Minecraft files without launching.

#### Parameters

- `options` (Object)
  - `version` (string) - Minecraft version
  - `destDir` (string) - Destination directory

#### Returns

Object containing paths to downloaded files:
- `clientJar` - Path to Minecraft client JAR
- `libraries` - Array of library JAR paths
- `assetsDir` - Path to assets directory
- `assetIndexPath` - Path to asset index file

### `axocore.authenticate(options)`

Authenticate with a Yggdrasil server.

#### Parameters

- `options` (Object)
  - `username` (string) - Username
  - `password` (string) - Password
  - `authServer` (string, optional) - Authentication server URL

#### Returns

Authentication response containing access token and profile information.

## Directory Structure

axocore creates a standard Minecraft directory structure:

```
.minecraft/
├── assets/
│   ├── indexes/
│   └── objects/
├── libraries/
├── versions/
│   └── [version]/
│       ├── [version].jar
│       └── [version].json
├── saves/
├── mods/
├── resourcepacks/
├── logs/
├── crash-reports/
├── options.txt
├── servers.dat
└── launcher_profiles.json
```

## Examples

### Complete Example with Fabric, Custom Auth, and Progress/Log Callbacks

```javascript
const path = require('path');
const axocore = require('./index');

(async () => {
  // Launch Fabric Minecraft with explicit values
  console.log('Launching Minecraft...');
  await axocore.launch({
    modLoader: 'fabric',
    fabricVersion: 'fabric-loader-0.16.14-1.20.1',
    version: '1.20.1',
    javaPath: 'java',
    username: 'candiedapple',
    password: 'alpo123',
    authServer: 'https://nested.candiedapple.me/api/yggdrasil/authserver',
    destDir: path.resolve(__dirname, '.minecraft'),
    gameDir: path.resolve(__dirname, '.minecraft'),
    javaArgs: [
      `-javaagent:${path.join(path.resolve(__dirname, '.minecraft'), 'authlib-injector.jar')}=https://nested.candiedapple.me/api/yggdrasil`
    ],
    onDownloadProgress: (info) => {
      console.log('[Download]', info);
    },
    onGameLog: (line) => {
      console.log('[GameLog]', line);
    }
  });
})();
```

### Download Only (No Launch)

```javascript
const axocore = require('axocore');
const path = require('path');

(async () => {
  console.log('Downloading Minecraft files...');
  
  const result = await axocore.downloadAll({
    version: '1.20.1',
    destDir: path.resolve(__dirname, '.minecraft')
  });
  
  console.log('Download complete!');
  console.log('Client JAR:', result.clientJar);
  console.log('Libraries:', result.libraries.length, 'files');
  console.log('Assets directory:', result.assetsDir);
})();
```

## Authentication

### Offline Mode

When no password is provided, axocore generates an offline UUID and launches Minecraft in offline mode. This is useful for testing and development.

### Yggdrasil Authentication

axocore supports custom Yggdrasil authentication servers, which are compatible with the Minecraft authentication protocol. This allows integration with custom authentication systems.

### AuthLib Injector

For custom authentication servers, you may need to use authlib-injector. Add it to your Java arguments:

```javascript
javaArgs: [
  '-javaagent:path/to/authlib-injector.jar=https://your-auth-server.com/api/yggdrasil'
]
```

## Mod Support

### Fabric

axocore has built-in support for Fabric mod loader. When using Fabric:

1. Specify `modLoader: 'fabric'`
2. Provide the `fabricVersion` (e.g., 'fabric-loader-0.16.14-1.20.1')
3. Place mods in the `mods/` directory within your game directory

### Adding Mods

After launching with Fabric, you can add mods by placing `.jar` files in the `mods/` directory:

```
.minecraft/
└── mods/
    ├── fabric-api.jar
    ├── jei.jar
    └── your-mod.jar
```

## Troubleshooting

### Common Issues

1. **Java not found**: Ensure Java is installed and the `javaPath` is correct
2. **Permission errors**: Make sure the destination directory is writable
3. **Network issues**: Check internet connection for downloading files
4. **Authentication failures**: Verify username, password, and auth server URL

### Logs

Minecraft logs are saved to `logs/latest.log` in the game directory. Check this file for detailed error information.

### Crash Reports

If Minecraft crashes, crash reports are saved to the `crash-reports/` directory with timestamps.

## Platform Support

- **Windows**: Full support
- **macOS**: Full support  
- **Linux**: Full support

Default Minecraft directories by platform:
- Windows: `%APPDATA%\.minecraft`
- macOS: `~/Library/Application Support/minecraft`
- Linux: `~/.minecraft`

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Changelog

### v0.1.0
- Initial release
- Basic Minecraft downloading and launching
- Offline mode support
- Yggdrasil authentication
- Fabric mod loader support
- Cross-platform compatibility
