const { mintTokens } = require('../scripts/mintTokens');

mintTokens(
  'arweave.net',
  443,
  'https',
  'mainnet',
  'assemblyscript/token-based-disputes/deploy/mainnet/.secrets/wallet-mainnet.json'
).finally();
