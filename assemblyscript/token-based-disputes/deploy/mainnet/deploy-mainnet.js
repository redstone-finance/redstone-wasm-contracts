const { deploy } = require('../scripts/deploy');

deploy(
  'arweave.net',
  443,
  'https',
  'mainnet',
  'assemblyscript/token-based-disputes/deploy/mainnet/.secrets/wallet_mainnet.json'
).finally();
