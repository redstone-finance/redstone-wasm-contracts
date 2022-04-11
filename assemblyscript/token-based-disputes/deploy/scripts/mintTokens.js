const fs = require('fs');
const path = require('path');
const { SmartWeaveNodeFactory } = require('redstone-smartweave');
const { mineBlock } = require('./utils/mine-block');
const { loadWallet, walletAddress } = require('./utils/load-wallet');
const { connectArweave } = require('./utils/connect-arweave');
const { addFunds } = require('./utils/addFunds');

module.exports.mintTokens = async function (host, port, protocol, target, walletJwk) {
  const arweave = connectArweave(host, port, protocol);
  const smartweave = SmartWeaveNodeFactory.memCached(arweave);

  const wallet = JSON.parse(fs.readFileSync(path.join(walletJwk), 'utf-8'));

  await addFunds(arweave, wallet);

  const contractId = fs.readFileSync(path.join(__dirname, `../${target}/contract-tx-id.txt`), 'utf-8').trim();

  let contract = smartweave.contract(contractId);

  // connecting wallet to the contract
  contract.connect(wallet);

  const txId = await contract.writeInteraction({
    function: 'mint',
    mint: {
      qty: 555,
    },
  });

  await mineBlock(arweave);

  const state = await contract.readState();
  console.log('state', state);
  if (target == 'testnet') {
    console.log(`Check mint interaction at https://sonar.redstone.tools/#/app/interaction/${txId}?network=testnet`);
  } else {
    console.log('Mint interaction tx id', contractTxId);
  }
};
