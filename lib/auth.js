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
  try {
    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    return res.data;
  } catch (err) {
    if (err.response) {
      throw new Error(`Authentication failed: ${err.response.status} ${err.response.statusText}`);
    } else {
      throw new Error(`Authentication failed: ${err.message}`);
    }
  }
}

module.exports = { authenticate };
