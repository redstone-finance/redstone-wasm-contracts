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
import { StateSchema } from '../assemblyscript/fake-news/assembly/schemas';

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

    contractSrc = fs.readFileSync(path.join(__dirname, '../assemblyscript/fake-news/build/optimized.wasm'));
    const stateFromFile: StateSchema = JSON.parse(
      fs.readFileSync(path.join(__dirname, './data/fake-news-state.json'), 'utf8')
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
        id: 'fake-news-id',
        title: 'fake-news-title',
        description: 'fake-news-description',
        options: ['true', 'false'],
        expirationBlocks: 6,
      },
    });

    await mineBlock(arweave);
    const state = await pst.readState();

    expect(state.state.disputes['fake-news-id']).toBeTruthy();
  });

  it('should properly create dispute with initial stake amount', async () => {
    await pst.writeInteraction({
      function: 'createDispute',
      createDispute: {
        id: 'fake-news-id-stake',
        title: 'fake-news-title-stake',
        description: 'fake-news-description-stake',
        options: ['true', 'false'],
        expirationBlocks: 20,
        initialStakeAmount: 500,
      },
    });

    await mineBlock(arweave);
    const state = await pst.readState();

    expect(state.state.disputes['fake-news-id-stake'].votes[0][walletAddress]).toEqual(500);
  });

  it('should not calculate rewards before the expiration block', async () => {
    await pst.writeInteraction({
      function: 'vote',
      vote: {
        id: 'fake-news-first',
        selectedOptionIndex: 0,
        stakeAmount: 5000,
      },
    });
    await mineBlock(arweave);

    await pst.writeInteraction({
      function: 'withdrawReward',
      withdrawReward: {
        id: 'fake-news-first',
      },
    });
    await mineBlock(arweave);

    const { state } = await pst.readState();

    expect(state.disputes['fake-news-first'].withdrawableAmounts).toEqual({});
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
        id: 'fake-news-first',
      },
    });
    await mineBlock(arweave);

    const { state } = await pst.readState();

    expect(state.disputes['fake-news-first'].withdrawableAmounts[walletAddress]).toEqual(0);
    expect(
      state.disputes['fake-news-first'].withdrawableAmounts['33F0QHcb22W7LwWR1iRC8Az1ntZG09XQ03YWuw2ABqA']
    ).toEqual(48);
  });
});
