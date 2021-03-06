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

jest.setTimeout(3000);
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
  creationTimestamp: number;
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
  let currentTimestamp: number;

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

    await mineBlock(arweave);

    const result = await arweave.blocks.getCurrent();

    currentTimestamp = result.timestamp;

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
          [walletAddress]: '2056690000',
        },
        disputes: {
          ...stateFromFile.disputes,
          // @ts-ignore
          tokenBasedDisputesExpiration: {
            ...stateFromFile.disputes['tokenBasedDisputesExpiration'],
            expirationTimestamp: (currentTimestamp + 86400).toString(),
          },
          tokenBasedDisputesAuthorized: {
            ...stateFromFile.disputes['tokenBasedDisputesAuthorized'],
            expirationTimestamp: (currentTimestamp - 1).toString(),
          },
          tokenBasedDisputesRewards: {
            ...stateFromFile.disputes['tokenBasedDisputesRewards'],
            expirationTimestamp: (currentTimestamp + 2000).toString(),
          },
          tokenBasedDisputesQuadratic: {
            ...stateFromFile.disputes['tokenBasedDisputesQuadratic'],
            expirationTimestamp: (currentTimestamp + 2000 + 2000).toString(),
          },
          tokenBasedDisputesDraw: {
            ...stateFromFile.disputes['tokenBasedDisputesDraw'],
            expirationTimestamp: (currentTimestamp + 2000 + 2000 + 2000).toString(),
          },
          tokenBasedDisputesMultipleOptions: {
            ...stateFromFile.disputes['tokenBasedDisputesMultipleOptions'],
            expirationTimestamp: (currentTimestamp + 2000 + 2000 + 2000 + 2000).toString(),
          },
        },
      },
    };

    // deploying contract using the new SDK.
    contractTxId = await smartweave.createContract.deploy({
      wallet,
      initState: JSON.stringify(initialState),
      src: contractSrc,
      wasmSrcCodeDir: path.join(__dirname, '../assembly'),
    });

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
    expect(result.state.balances['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']).toEqual('100000000');
  });

  it('should properly transfer tokens', async () => {
    await contract.writeInteraction({
      function: 'transfer',
      transfer: {
        target: 'uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M',
        qty: '5550000',
      },
    });

    await mineBlock(arweave);

    expect((await contract.readState()).state.balances[walletAddress]).toEqual((2056690000 - 5550000).toString());
    expect((await contract.readState()).state.balances['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']).toEqual(
      (100000000 + 5550000).toString()
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
        expirationTimestamp: (currentTimestamp + 20 * 86400).toString(),
      },
    });

    await mineBlock(arweave);
    const { state } = await contract.readState();

    expect(state.disputes['token-based-disputes-id']).toBeTruthy();
  });

  it('should properly set creation timestamp', async () => {
    const { state } = await contract.readState();
    expect(state.disputes['token-based-disputes-id'].creationTimestamp).toBeTruthy();
  });

  it('should properly create dispute with initial stake amount', async () => {
    await contract.writeInteraction({
      function: 'createDispute',
      createDispute: {
        id: 'token-based-disputes-id-stake',
        title: 'token-based-disputes-title-stake',
        description: 'token-based-disputes-description-stake',
        options: ['true', 'false'],
        expirationTimestamp: (currentTimestamp + 20 * 86400).toString(),
        initialStakeAmount: { amount: '5000000', optionIndex: 0 },
      },
    });

    await mineBlock(arweave);
    const { state } = await contract.readState();

    expect(state.balances[walletAddress]).toEqual((2056690000 - 5550000 - 5000000).toString());
    expect(state.disputes['token-based-disputes-id-stake'].votes[0].votes[walletAddress].stakedAmount).toEqual(
      '5000000'
    );
  });

  it('should not create dispute with the same id', async () => {
    await contract.writeInteraction({
      function: 'createDispute',
      createDispute: {
        id: 'token-based-disputes-id-stake',
        title: 'token-based-disputes-title-stake',
        description: 'token-based-disputes-description-stake',
        options: ['true', 'false'],
        expirationTimestamp: currentTimestamp + 20 * 86400,
        initialStakeAmount: { amount: '5000000', optionIndex: 0 },
      },
    });

    await mineBlock(arweave);
    const state = await contract.readState();

    const disputeCount = Object.keys(state.state.disputes).filter((key) => {
      return key === 'token-based-disputes-id-stake';
    }).length;
    expect(disputeCount).toEqual(1);
  });

  it('should not calculate rewards before the expiration time', async () => {
    await contract.writeInteraction({
      function: 'vote',
      vote: {
        id: 'tokenBasedDisputesExpiration',
        selectedOptionIndex: 0,
        stakeAmount: '50000000',
      },
    });
    await mineBlock(arweave);

    await contract.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'tokenBasedDisputesExpiration',
      },
    });
    await mineBlock(arweave);

    const { state } = await contract.readState();

    expect(state.disputes['tokenBasedDisputesExpiration'].withdrawableAmounts).toEqual({});
  });

  it('should not withdraw reward when caller is not authorized', async () => {
    const newWallet = await arweave.wallets.generate();
    const overwrittenCaller = await arweave.wallets.jwkToAddress(newWallet);

    await contract.dryWrite(
      {
        function: 'withdrawReward',
        withdrawReward: {
          id: 'token-based-disputes-authorized',
        },
      },
      overwrittenCaller
    );

    const { state } = await contract.readState();

    expect(state.disputes['tokenBasedDisputesAuthorized'].withdrawableAmounts).toEqual({});
  });

  it('should correctly calculate rewards', async () => {
    await contract.writeInteraction({
      function: 'vote',
      vote: {
        id: 'tokenBasedDisputesRewards',
        selectedOptionIndex: 0,
        stakeAmount: '50000000',
      },
    });

    await mineBlock(arweave);
    Date.now = jest.fn(() => (currentTimestamp + 2000 + 1) * 1000);

    await contract.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'tokenBasedDisputesRewards',
      },
    });

    await mineBlock(arweave);

    const { state } = await contract.readState();
    state.disputes['tokenBasedDisputesRewards'].withdrawableAmounts[walletAddress];
    expect(state.disputes['tokenBasedDisputesRewards'].withdrawableAmounts[walletAddress]).toEqual('0');
    expect(state.balances[walletAddress]).toEqual((2056690000 - 5550000 - 5000000 - 50000000 + 2499999).toString());
    expect(
      state.disputes['tokenBasedDisputesRewards'].withdrawableAmounts['33F0QHcb22W7LwWR1iRC8Az1ntZG09XQ03YWuw2ABqA']
    ).toEqual('10499998');
    expect(state.balances['33F0QHcb22W7LwWR1iRC8Az1ntZG09XQ03YWuw2ABqA']).toEqual('231120000');
    expect(
      state.disputes['tokenBasedDisputesRewards'].withdrawableAmounts['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']
    ).toBeFalsy();
    expect(state.balances['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']).toEqual((100000000 + 5550000).toString());
  });

  it('should correctly set winning option after calculating rewards', async () => {
    const { state } = await contract.readState();

    expect(state.disputes['tokenBasedDisputesRewards'].winningOption).toEqual('true');
  });

  it('should not withdraw any tokens if caller already has withdrew reward', async () => {
    await contract.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'tokenBasedDisputesRewards',
      },
    });
    await mineBlock(arweave);

    const { state } = await contract.readState();

    expect(state.disputes['tokenBasedDisputesRewards'].withdrawableAmounts[walletAddress]).toEqual('0');
    expect(state.balances[walletAddress]).toEqual((2056690000 - 5550000 - 5000000 - 50000000 + 2499999).toString());
  });

  it('should properly calculate quadratic formula', async () => {
    await contract.writeInteraction({
      function: 'createDispute',
      createDispute: {
        id: 'tokenBasedDisputeQuadraticStake',
        title: 'tokenBasedDisputeQuadraticStakeTitle',
        description: 'tokenBasedDisputeQuadraticStakeDescription',
        options: ['true', 'false'],
        expirationTimestamp: (currentTimestamp + 20 * 86400).toString(),
        initialStakeAmount: { amount: '10000', optionIndex: 0 },
      },
    });

    await mineBlock(arweave);
    const { state } = await contract.readState();

    expect(state.disputes['tokenBasedDisputeQuadraticStake'].votes[0].votes[walletAddress].stakedAmount).toEqual(
      '10000'
    );
    expect(state.disputes['tokenBasedDisputeQuadraticStake'].votes[0].votes[walletAddress].quadraticAmount).toEqual(
      '1'
    );
  });

  it('should properly indicate winning option using quadratic formula', async () => {
    await contract.writeInteraction({
      function: 'vote',
      vote: {
        id: 'tokenBasedDisputesQuadratic',
        selectedOptionIndex: 0,
        stakeAmount: '1000000',
      },
    });

    await mineBlock(arweave);

    Date.now = jest.fn(() => (currentTimestamp + 2000 + 2000 + 1) * 1000);

    await contract.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'tokenBasedDisputesQuadratic',
      },
    });
    await mineBlock(arweave);

    const { state } = await contract.readState();
    expect(state.disputes['tokenBasedDisputesQuadratic'].winningOption).toEqual('true');
    expect(state.balances[walletAddress]).toEqual(
      (2056690000 - 5550000 - 5000000 - 50000000 + 2499999 - 10000 + 1333332).toString()
    );
  });

  it('should return staked tokens to holders in case of draw', async () => {
    await contract.writeInteraction({
      function: 'vote',
      vote: {
        id: 'tokenBasedDisputesDraw',
        selectedOptionIndex: 0,
        stakeAmount: '1000000',
      },
    });
    await mineBlock(arweave);

    Date.now = jest.fn(() => (currentTimestamp + 2000 + 2000 + 2000 + 1) * 1000);

    await contract.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'tokenBasedDisputesDraw',
      },
    });
    await mineBlock(arweave);

    const { state } = await contract.readState();
    expect(state.balances[walletAddress]).toEqual(
      (2056690000 - 5550000 - 5000000 - 50000000 + 2499999 - 10000 + 1333332).toString()
    );
    expect(
      state.disputes['tokenBasedDisputesDraw'].withdrawableAmounts['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']
    ).toEqual('2000000');
  });

  it('should correctly calculate rewards in case of multiple options', async () => {
    await contract.writeInteraction({
      function: 'vote',
      vote: {
        id: 'tokenBasedDisputesMultipleOptions',
        selectedOptionIndex: 2,
        stakeAmount: '50000000',
      },
    });

    await mineBlock(arweave);
    Date.now = jest.fn(() => (currentTimestamp + 2000 + 2000 + 2000 + 2000 + 1) * 1000);

    await contract.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'tokenBasedDisputesMultipleOptions',
      },
    });
    await mineBlock(arweave);
    const { state } = await contract.readState();
    expect(state.balances[walletAddress]).toEqual(
      (2056690000 - 5550000 - 5000000 - 50000000 + 2499999 - 10000 + 1333332 + 50961514).toString()
    );
    expect(state.disputes['tokenBasedDisputesMultipleOptions'].withdrawableAmounts[walletAddress]).toEqual('0');
    expect(
      state.disputes['tokenBasedDisputesMultipleOptions'].withdrawableAmounts[
        'Tk1NuG7Jxr9Ecgva5tWOJya2QGDOoS6hMZP0paB129c'
      ]
    ).toEqual('4038433');
    expect(
      state.disputes['tokenBasedDisputesMultipleOptions'].withdrawableAmounts[
        'MBB9dcPWUG_t75ezcBwt7u3C0vCyu4tuwxjstlCpvIE'
      ]
    ).toBeFalsy();
    expect(
      state.disputes['tokenBasedDisputesMultipleOptions'].withdrawableAmounts[
        'dRFuVE-s6-TgmykU4Zqn246AR2PIsf3HhBhZ0t5-WXE'
      ]
    ).toBeFalsy();
    expect(
      state.disputes['tokenBasedDisputesMultipleOptions'].withdrawableAmounts[
        '4JOmaT9fFe2ojFJEls3Zow5UKO2CBOk7lOirbPTtX1o'
      ]
    ).toBeFalsy();
  });

  // evolve

  it("should properly evolve contract's source code", async () => {
    expect((await contract.readState()).state.balances[walletAddress]).toEqual(
      (2056690000 - 5550000 - 5000000 - 50000000 + 2499999 - 10000 + 1333332 + 50961514).toString()
    );
    const newSource = fs.readFileSync(path.join(__dirname, './data/token-based-disputes-evolve.js'), 'utf8');

    const { arweave } = smartweave;

    const tx = await arweave.createTransaction({ data: newSource }, wallet);
    tx.addTag(SmartWeaveTags.APP_NAME, 'SmartWeaveContractSource');
    tx.addTag(SmartWeaveTags.APP_VERSION, '0.3.0');
    tx.addTag('Content-Type', 'application/javascript');

    await arweave.transactions.sign(tx, wallet);
    await arweave.transactions.post(tx);

    await mineBlock(arweave);

    await contract.writeInteraction({
      function: 'evolve',
      evolve: {
        value: tx.id,
      },
    });
    await mineBlock(arweave);
    console.log((await contract.readState()).state);

    // note: the evolved balance always adds 555 to the result
    const result = await contract.viewState<BalanceEvolveInput, Balance>({
      function: 'balance',
      target: 'uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M',
    });
    expect(await result.result.balance).toEqual(100000000 + 5550000 + 5550000);
  });
});
