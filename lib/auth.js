// Yggdrasil authentication for Minecraft (custom or Mojang servers)


async function authenticate({ username, password, authServer = 'https://authserver.mojang.com' }) {
  const url = authServer.replace(/\/$/, '') + '/authenticate';
  const payload = {
    agent: { name: 'Minecraft', version: 1 },
    username,
    password,
    requestUser: true
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error(`Authentication failed: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

module.exports = { authenticate };
