const { deploy } = require('../scripts/deploy');

deploy(
  'testnet.redstone.tools',
  443,
  'https',
  'testnet',
  'assemblyscript/fake-news/deploy/testnet/wallet_testnet.json'
).finally();
