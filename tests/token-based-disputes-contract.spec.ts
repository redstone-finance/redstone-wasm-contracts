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
  let pst: Contract<ExampleContractState>;
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

    // LoggerFactory.INST.logLevel('error');
    LoggerFactory.INST.logLevel('debug');

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

    // connecting to the PST contract
    pst = smartweave.contract(contractTxId);

    // connecting wallet to the PST contract
    pst.connect(wallet);

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

  it('should properly create dispute', async () => {
    await pst.writeInteraction({
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
    const state = await pst.readState();

    expect(state.state.disputes['token-based-disputes-id']).toBeTruthy();
  });

  it('should properly create dispute with initial stake amount', async () => {
    await pst.writeInteraction({
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
    const state = await pst.readState();

    expect(state.state.disputes['token-based-disputes-id-stake'].votes[0].votes[walletAddress]).toEqual(500);
  });

  it('should not calculate rewards before the expiration block', async () => {
    await pst.writeInteraction({
      function: 'vote',
      vote: {
        id: 'token-based-disputes-first',
        selectedOptionIndex: 0,
        stakeAmount: 5000,
      },
    });
    await mineBlock(arweave);

    await pst.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'token-based-disputes-first',
      },
    });
    await mineBlock(arweave);

    const { state } = await pst.readState();

    expect(state.disputes['token-based-disputes-first'].withdrawableAmounts).toEqual({});
  });

  it('should correctly calculate rewards', async () => {
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);
    await mineBlock(arweave);

    await pst.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'token-based-disputes-first',
      },
    });
    await mineBlock(arweave);

    const { state } = await pst.readState();

    expect(state.disputes['token-based-disputes-first'].withdrawableAmounts[walletAddress]).toEqual(0);
    expect(
      state.disputes['token-based-disputes-first'].withdrawableAmounts['33F0QHcb22W7LwWR1iRC8Az1ntZG09XQ03YWuw2ABqA']
    ).toEqual(50);
  });
});
