// Generate offline UUID for Minecraft username (same as Mojang's offline UUID)
const crypto = require('crypto');

function getOfflineUUID(username) {
  // Mojang's offline UUID: UUIDv3 (MD5) of 'OfflinePlayer:' + username
  const data = 'OfflinePlayer:' + username;
  const md5 = crypto.createHash('md5').update(data).digest();
  md5[6] = (md5[6] & 0x0f) | 0x30; // version 3
  md5[8] = (md5[8] & 0x3f) | 0x80; // variant
  const hex = md5.toString('hex');
  return [
    hex.substr(0, 8),
    hex.substr(8, 4),
    hex.substr(12, 4),
    hex.substr(16, 4),
    hex.substr(20, 12)
  ].join('-');
}

module.exports = { getOfflineUUID };
