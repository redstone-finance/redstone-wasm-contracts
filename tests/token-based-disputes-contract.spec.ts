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

jest.setTimeout(6000);
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
          [walletAddress]: 2056690000,
        },
        disputes: {
          ...stateFromFile.disputes,
          // @ts-ignore
          tokenBasedDisputesFirst: {
            ...stateFromFile.disputes['tokenBasedDisputesFirst'],
            expirationTimestamp: (currentTimestamp + 86400).toString(),
          },
          tokenBasedDisputesAuthorized: {
            ...stateFromFile.disputes['tokenBasedDisputesAuthorized'],
            expirationTimestamp: (currentTimestamp - 1).toString(),
          },
          tokenBasedDisputesSecond: {
            ...stateFromFile.disputes['tokenBasedDisputesSecond'],
            expirationTimestamp: (currentTimestamp - 2000).toString(),
            votes: [
              {
                label: 'true',
                votes: {
                  '33F0QHcb22W7LwWR1iRC8Az1ntZG09XQ03YWuw2ABqA': 2000000,
                  [walletAddress]: 1000000,
                },
              },
              {
                label: 'false',
                votes: {
                  'uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M': 2000000,
                  'lEHcYq6BuDGGFzooeh-PZH2lXi00UzEBB6NiYLbE93w': 1000000,
                },
              },
            ],
          },
          tokenBasedDisputesThird: {
            ...stateFromFile.disputes['tokenBasedDisputesThird'],
            expirationTimestamp: (currentTimestamp + 2000).toString(),
          },
          tokenBasedDisputesRewards: {
            ...stateFromFile.disputes['tokenBasedDisputesRewards'],
            expirationTimestamp: (currentTimestamp - 86400).toString(),
            votes: [
              {
                label: 'true',
                votes: {
                  '33F0QHcb22W7LwWR1iRC8Az1ntZG09XQ03YWuw2ABqA': 10000000,
                  [walletAddress]: 50000000,
                },
              },
              {
                label: 'false',
                votes: {
                  'uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M': 2000000,
                  'lEHcYq6BuDGGFzooeh-PZH2lXi00UzEBB6NiYLbE93w': 1000000,
                },
              },
            ],
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
    expect(result.state.balances['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']).toEqual(100000000);
  });

  it('should properly transfer tokens', async () => {
    await contract.writeInteraction({
      function: 'transfer',
      transfer: {
        target: 'uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M',
        qty: 5550000,
      },
    });

    await mineBlock(arweave);

    expect((await contract.readState()).state.balances[walletAddress]).toEqual(2056690000 - 5550000);
    expect((await contract.readState()).state.balances['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']).toEqual(
      100000000 + 5550000
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
        initialStakeAmount: { amount: 5000000, optionIndex: 0 },
      },
    });

    await mineBlock(arweave);
    const { state } = await contract.readState();

    expect(state.balances[walletAddress]).toEqual(2056690000 - 5550000 - 5000000);
    expect(state.disputes['token-based-disputes-id-stake'].votes[0].votes[walletAddress]).toEqual(5000000);
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
        initialStakeAmount: { amount: 5000000, optionIndex: 0 },
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
        id: 'tokenBasedDisputesFirst',
        selectedOptionIndex: 0,
        stakeAmount: 50000000,
      },
    });
    await mineBlock(arweave);

    await contract.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'tokenBasedDisputesFirst',
      },
    });
    await mineBlock(arweave);

    const { state } = await contract.readState();

    expect(state.disputes['tokenBasedDisputesFirst'].withdrawableAmounts).toEqual({});
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
      function: 'withdrawReward',
      withdrawReward: {
        id: 'tokenBasedDisputesRewards',
      },
    });
    await mineBlock(arweave);

    const { state } = await contract.readState();
    state.disputes['tokenBasedDisputesRewards'].withdrawableAmounts[walletAddress];
    expect(state.disputes['tokenBasedDisputesRewards'].withdrawableAmounts[walletAddress]).toEqual(0);
    expect(state.balances[walletAddress]).toEqual(2056690000 - 5550000 - 5000000 + 2499999);
    expect(
      state.disputes['tokenBasedDisputesRewards'].withdrawableAmounts['33F0QHcb22W7LwWR1iRC8Az1ntZG09XQ03YWuw2ABqA']
    ).toEqual(10499998);
    expect(state.balances['33F0QHcb22W7LwWR1iRC8Az1ntZG09XQ03YWuw2ABqA']).toEqual(231120000);
    expect(
      state.disputes['tokenBasedDisputesRewards'].withdrawableAmounts['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']
    ).toBeFalsy();
    expect(state.balances['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']).toEqual(100000000 + 5550000);
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

    expect(state.disputes['tokenBasedDisputesRewards'].withdrawableAmounts[walletAddress]).toEqual(0);
    expect(state.balances[walletAddress]).toEqual(2056690000 - 5550000 - 5000000 + 2499999);
  });

  it('should return staked tokens to holders in case of draw', async () => {
    await contract.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'tokenBasedDisputesSecond',
      },
    });
    await mineBlock(arweave);

    const { state } = await contract.readState();
    expect(state.balances[walletAddress]).toEqual(2056690000 - 5550000 - 5000000 + 2499999 + 1000000);
    expect(
      state.disputes['tokenBasedDisputesSecond'].withdrawableAmounts['uhE-QeYS8i4pmUtnxQyHD7dzXFNaJ9oMK-IM-QPNY6M']
    ).toEqual(2000000);
  });

  it('should correctly calculate rewards in case of multiple options', async () => {
    jest.useFakeTimers();

    await contract.writeInteraction({
      function: 'vote',
      vote: {
        id: 'tokenBasedDisputesThird',
        selectedOptionIndex: 2,
        stakeAmount: 50000000,
      },
    });

    await mineBlock(arweave);
    setTimeout(async () => {
      await contract.writeInteraction({
        function: 'withdrawReward',
        withdrawReward: {
          id: 'tokenBasedDisputesThird',
        },
      });
      await mineBlock(arweave);
      const { state } = await contract.readState();
      expect(state.balances[walletAddress]).toEqual(2056690000 - 5550000 - 5000000 + 2499999 + 50961514 + 1000000);
      expect(state.disputes['tokenBasedDisputesThird'].withdrawableAmounts[walletAddress]).toEqual(0);
      expect(
        state.disputes['tokenBasedDisputesThird'].withdrawableAmounts['Tk1NuG7Jxr9Ecgva5tWOJya2QGDOoS6hMZP0paB129c']
      ).toEqual(4038433);
      expect(
        state.disputes['tokenBasedDisputesThird'].withdrawableAmounts['MBB9dcPWUG_t75ezcBwt7u3C0vCyu4tuwxjstlCpvIE']
      ).toBeFalsy();
      expect(
        state.disputes['tokenBasedDisputesThird'].withdrawableAmounts['dRFuVE-s6-TgmykU4Zqn246AR2PIsf3HhBhZ0t5-WXE']
      ).toBeFalsy();
      expect(
        state.disputes['tokenBasedDisputesThird'].withdrawableAmounts['4JOmaT9fFe2ojFJEls3Zow5UKO2CBOk7lOirbPTtX1o']
      ).toBeFalsy();
    }, 2000);
    jest.advanceTimersByTime(1000);
  });

  // evolve

  it("should properly evolve contract's source code", async () => {
    setTimeout(async () => {
      expect((await contract.readState()).state.balances[walletAddress]).toEqual(
        2056690000 - 5550000 - 5000000 + 2499999 + 50961514
      );

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
      expect(await result.result.balance).toEqual(100000000 + 5550000 + 5550000);
    });
  });
});
