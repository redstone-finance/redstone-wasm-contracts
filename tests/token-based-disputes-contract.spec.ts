import fs from 'fs';

import ArLocal from 'arlocal';
import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';
import {
  getTag,
  LoggerFactory,
  Contract,
  SmartWeave,
  SmartWeaveNodeFactory,
  SmartWeaveTags,
} from 'redstone-smartweave';
import path from 'path';
import { addFunds, mineBlock } from '../utils';
import { StateSchema } from '../assemblyscript/token-based-disputes/assembly/schemas';

jest.setTimeout(30000);

export class Balance {
  balance: number;
  target: string;
  ticker: string;
}

interface BalanceInput {
  function: string;
  balance: {
    target: string;
  };
}

interface BalanceEvolveInput {
  function: string;
  target: string;
}

interface BalanceEvolveInput {
  function: string;
  target: string;
}
interface ExampleContractState {
  balances: Map<string, number>;
  canEvolve: boolean;
  evolve: string | null;
  name: string;
  owner: string;
  ticker: string;
  disputes: Map<string, DisputeSchema>;
}

interface DisputeSchema {
  id: string;
  title: string;
  description: string;
  options: string[];
  votes: Map<string, number>[];
  expirationBlock: number;
  withdrawableAmounts: Map<string, number>;
  calculated: boolean;
}

describe('Testing the Profit Sharing Token', () => {
  let contractSrc: Buffer;

  let wallet: JWKInterface;
  let walletAddress: string;

  let initialState: StateSchema;

  let arweave: Arweave;
  let arlocal: ArLocal;
  let smartweave: SmartWeave;
  let contract: Contract<ExampleContractState>;
  let contractTxId: string;

  beforeAll(async () => {
    // note: each tests suit (i.e. file with tests that Jest is running concurrently
    // with another files has to have ArLocal set to a different port!)
    arlocal = new ArLocal(1820, false);
    await arlocal.start();

    arweave = Arweave.init({
      host: 'localhost',
      port: 1820,
      protocol: 'http',
    });

    LoggerFactory.INST.logLevel('error');

    smartweave = SmartWeaveNodeFactory.memCached(arweave);

    wallet = await arweave.wallets.generate();
    await addFunds(arweave, wallet);
    walletAddress = await arweave.wallets.jwkToAddress(wallet);

    contractSrc = fs.readFileSync(path.join(__dirname, '../assemblyscript/build/optimized.wasm'));
    const stateFromFile: StateSchema = JSON.parse(
      fs.readFileSync(path.join(__dirname, './data/token-based-disputes-state.json'), 'utf8')
    );

    initialState = {
      ...stateFromFile,
      ...{
        owner: walletAddress,
        balances: {
          ...stateFromFile.balances,
          [walletAddress]: 555669,
        },
      },
    };

    // deploying contract using the new SDK.
    contractTxId = await smartweave.createContract.deploy(
      {
        wallet,
        initState: JSON.stringify(initialState),
        src: contractSrc,
      },
      path.join(__dirname, '../assembly')
    );

    // connecting to the contract
    contract = smartweave.contract(contractTxId);

    // connecting wallet to the contract
    contract.connect(wallet);

    await mineBlock(arweave);
  });

  afterAll(async () => {
    await arlocal.stop();
  });

  it('should properly deploy contract', async () => {
    const contractTx = await arweave.transactions.get(contractTxId);

    expect(contractTx).not.toBeNull();
    expect(getTag(contractTx, SmartWeaveTags.CONTRACT_TYPE)).toEqual('wasm');
    expect(getTag(contractTx, SmartWeaveTags.WASM_LANG)).toEqual('assemblyscript');

    const contractSrcTx = await arweave.transactions.get(getTag(contractTx, SmartWeaveTags.CONTRACT_SRC_TX_ID));
    expect(getTag(contractSrcTx, SmartWeaveTags.CONTENT_TYPE)).toEqual('application/wasm');
    expect(getTag(contractSrcTx, SmartWeaveTags.WASM_LANG)).toEqual('assemblyscript');
  });

  // pst interactions

  it('should read contract state and balance data', async () => {
    expect((await contract.readState()).state).toEqual(initialState);
    const result = await contract.viewState<BalanceInput, Balance>({
      function: 'balance',
      balance: {
        target: 'uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M',
      },
    });
    expect(result.state.balances['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']).toEqual(10000000);
  });

  it('should properly transfer tokens', async () => {
    await contract.writeInteraction({
      function: 'transfer',
      transfer: {
        target: 'uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M',
        qty: 555,
      },
    });

    await mineBlock(arweave);

    expect((await contract.readState()).state.balances[walletAddress]).toEqual(555669 - 555);
    expect((await contract.readState()).state.balances['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']).toEqual(
      10000000 + 555
    );
  });

  // dispute interactions
  it('should properly create dispute', async () => {
    await contract.writeInteraction({
      function: 'createDispute',
      createDispute: {
        id: 'token-based-disputes-id',
        title: 'token-based-disputes-title',
        description: 'token-based-disputes-description',
        options: ['true', 'false'],
        expirationBlocks: 6,
      },
    });

    await mineBlock(arweave);
    const state = await contract.readState();

    expect(state.state.disputes['token-based-disputes-id']).toBeTruthy();
  });

  it('should properly create dispute with initial stake amount', async () => {
    await contract.writeInteraction({
      function: 'createDispute',
      createDispute: {
        id: 'token-based-disputes-id-stake',
        title: 'token-based-disputes-title-stake',
        description: 'token-based-disputes-description-stake',
        options: ['true', 'false'],
        expirationBlocks: 20,
        initialStakeAmount: { amount: 500, optionIndex: 0 },
      },
    });

    await mineBlock(arweave);
    const state = await contract.readState();

    expect(state.state.disputes['token-based-disputes-id-stake'].votes[0].votes[walletAddress]).toEqual(500);
  });

  it('should not create dispute with the same id', async () => {
    await contract.writeInteraction({
      function: 'createDispute',
      createDispute: {
        id: 'token-based-disputes-id-stake',
        title: 'token-based-disputes-title-stake',
        description: 'token-based-disputes-description-stake',
        options: ['true', 'false'],
        expirationBlocks: 20,
        initialStakeAmount: { amount: 500, optionIndex: 0 },
      },
    });

    await mineBlock(arweave);
    const state = await contract.readState();

    const disputeCount = Object.keys(state.state.disputes).filter((key) => {
      return key === 'token-based-disputes-id-stake';
    }).length;
    expect(disputeCount).toEqual(1);
  });

  it('should not calculate rewards before the expiration block', async () => {
    await contract.writeInteraction({
      function: 'vote',
      vote: {
        id: 'token-based-disputes-first',
        selectedOptionIndex: 0,
        stakeAmount: 5000,
      },
    });
    await mineBlock(arweave);

    await contract.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'token-based-disputes-first',
      },
    });
    await mineBlock(arweave);

    const { state } = await contract.readState();

    expect(state.disputes['token-based-disputes-first'].withdrawableAmounts).toEqual({});
  });

  it('should not withdraw reward when caller is not authorized', async () => {
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    const newWallet = await arweave.wallets.generate();
    const overwrittenCaller = await arweave.wallets.jwkToAddress(newWallet);

    await contract.dryWrite(
      {
        function: 'withdrawReward',
        withdrawReward: {
          id: 'token-based-disputes-first',
        },
      },
      overwrittenCaller
    );

    const { state } = await contract.readState();

    expect(state.disputes['token-based-disputes-first'].withdrawableAmounts).toEqual({});
  });

  it('should correctly calculate rewards', async () => {
    await contract.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'token-based-disputes-first',
      },
    });
    await mineBlock(arweave);

    const { state } = await contract.readState();

    expect(state.disputes['token-based-disputes-first'].withdrawableAmounts[walletAddress]).toEqual(0);
    expect(state.balances[walletAddress]).toEqual(555364);
    expect(
      state.disputes['token-based-disputes-first'].withdrawableAmounts['33F0QHcb22W7LwWR1iRC8Az1ntZG09XQ03YWuw2ABqA']
    ).toEqual(1050);
    expect(state.balances['33F0QHcb22W7LwWR1iRC8Az1ntZG09XQ03YWuw2ABqA']).toEqual(23111222);
    expect(
      state.disputes['token-based-disputes-first'].withdrawableAmounts['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']
    ).toBeFalsy();
    expect(state.balances['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']).toEqual(10000000 + 555);
  });

  it('should not withdraw any tokens if caller already has withdrew reward', async () => {
    await contract.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'token-based-disputes-first',
      },
    });
    await mineBlock(arweave);

    const { state } = await contract.readState();

    expect(state.disputes['token-based-disputes-first'].withdrawableAmounts[walletAddress]).toEqual(0);
    expect(state.balances[walletAddress]).toEqual(555364);
  });

  it('should correctly calculate rewards in case of multiple options', async () => {
    await contract.writeInteraction({
      function: 'vote',
      vote: {
        id: 'token-based-disputes-third',
        selectedOptionIndex: 2,
        stakeAmount: 5000,
      },
    });

    await mineBlock(arweave);

    await contract.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'token-based-disputes-third',
      },
    });
    await mineBlock(arweave);

    const { state } = await contract.readState();

    expect(state.balances[walletAddress]).toEqual(555364 + 5096);
    expect(state.disputes['token-based-disputes-third'].withdrawableAmounts[walletAddress]).toEqual(0);
    expect(
      state.disputes['token-based-disputes-third'].withdrawableAmounts['Tk1NuG7Jxr9Ecgva5tWOJya2QGDOoS6hMZP0paB129c']
    ).toEqual(403);
    expect(
      state.disputes['token-based-disputes-third'].withdrawableAmounts['MBB9dcPWUG_t75ezcBwt7u3C0vCyu4tuwxjstlCpvIE']
    ).toBeFalsy();
    expect(
      state.disputes['token-based-disputes-third'].withdrawableAmounts['dRFuVE-s6-TgmykU4Zqn246AR2PIsf3HhBhZ0t5-WXE']
    ).toBeFalsy();
    expect(
      state.disputes['token-based-disputes-third'].withdrawableAmounts['4JOmaT9fFe2ojFJEls3Zow5UKO2CBOk7lOirbPTtX1o']
    ).toBeFalsy();
  });

  it('should return staked tokens to holders in case of draw', async () => {
    await contract.writeInteraction({
      function: 'vote',
      vote: {
        id: 'token-based-disputes-second',
        selectedOptionIndex: 0,
        stakeAmount: 100,
      },
    });

    await mineBlock(arweave);

    await contract.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'token-based-disputes-second',
      },
    });
    await mineBlock(arweave);

    const { state } = await contract.readState();

    expect(state.balances[walletAddress]).toEqual(560460);
    expect(
      state.disputes['token-based-disputes-second'].withdrawableAmounts['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']
    ).toEqual(200);
  });

  // evolve

  it("should properly evolve contract's source code", async () => {
    expect((await contract.readState()).state.balances[walletAddress]).toEqual(560460);

    const newSource = fs.readFileSync(path.join(__dirname, './data/token-based-disputes-evolve.js'), 'utf8');

    const { arweave } = smartweave;

    const tx = await arweave.createTransaction({ data: newSource }, wallet);
    tx.addTag(SmartWeaveTags.APP_NAME, 'SmartWeaveContractSource');
    tx.addTag(SmartWeaveTags.APP_VERSION, '0.3.0');
    tx.addTag('Content-Type', 'application/javascript');

    await arweave.transactions.sign(tx, wallet);
    await arweave.transactions.post(tx);

    console.log('txid', tx.id);
    await mineBlock(arweave);

    await contract.writeInteraction({
      function: 'evolve',
      evolve: {
        value: tx.id,
      },
    });
    await mineBlock(arweave);

    // note: the evolved balance always adds 555 to the result
    const result = await contract.viewState<BalanceEvolveInput, Balance>({
      function: 'balance',
      target: 'uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M',
    });
    expect(await result.result.balance).toEqual(10000000 + 555 + 555);
  });
});
