const { deploy } = require('../scripts/deploy');

deploy('localhost', 1984, 'http', 'local', 'assemblyscript/fake-news/deploy/local/wallet_local.json').finally();
