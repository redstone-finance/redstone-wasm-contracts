const { deploy } = require('../scripts/deploy');

deploy(
  'localhost',
  1984,
  'http',
  'local',
  'assemblyscript/token-based-disputes/deploy/local/wallet_local.json'
).finally();
