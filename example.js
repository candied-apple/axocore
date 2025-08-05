const path = require('path');
const axocore = require('./index');

// Shared config
const mcVersion = '1.20.1';
const fabricVersion = 'fabric-loader-0.16.14-1.20.1';
const username = 'candiedapple';
const password = 'alpo123';
const authServer = 'https://nested.candiedapple.me/api/yggdrasil/authserver';
const javaPath = 'java';
const destDir = path.resolve(__dirname, 'mcdata');
const gameDir = destDir;
const javaArgs = [`-javaagent:${path.join(destDir, 'authlib-injector.jar')}=https://nested.candiedapple.me/api/yggdrasil`];



(async () => {
  // Launch Fabric minecraft only using the unified launch function
  console.log('Launching minecraft...');
  await axocore.launch({
    modLoader: 'fabric',
    fabricVersion,
    version: mcVersion,
    javaPath,
    username,
    password,
    authServer,
    destDir,
    gameDir,
    javaArgs
  });
})();
