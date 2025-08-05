// Yggdrasil authentication for Minecraft (custom or Mojang servers)
const axios = require('axios');

async function authenticate({ username, password, authServer = 'https://authserver.mojang.com' }) {
  const url = authServer.replace(/\/$/, '') + '/authenticate';
  const payload = {
    agent: { name: 'Minecraft', version: 1 },
    username,
    password,
    requestUser: true
  };
  const res = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
  return res.data;
}

module.exports = { authenticate };
