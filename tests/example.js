const path = require('path');
const axocore = require('../index');

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
    ]
  });
})();
