/// <reference types="node" />
import Arweave from 'arweave';
import { NetworkInfoInterface } from 'arweave/node/network';
import { GqlReqVariables } from '..';
import { AxiosResponse } from 'axios';
import Transaction from 'arweave/node/lib/transaction';
export declare class ArweaveWrapper {
    private readonly arweave;
    private readonly logger;
    private readonly baseUrl;
    constructor(arweave: Arweave);
    info(): Promise<Partial<NetworkInfoInterface>>;
    gql(query: string, variables: GqlReqVariables): Promise<Partial<AxiosResponse<any>>>;
    tx(id: string): Promise<Transaction>;
    txData(id: string): Promise<Buffer>;
    txDataString(id: string): Promise<string>;
}
//# sourceMappingURL=ArweaveWrapper.d.ts.map