import Arweave from 'arweave';
import { SmartWeave, SmartWeaveBuilder, StateCache } from '../index';
import { MemBlockHeightSwCache } from '../../cache/index';
/**
 * A factory that simplifies the process of creating different versions of {@link SmartWeave}.
 * All versions use the {@link Evolve} plugin.
 * SmartWeave instances created by this factory can be safely used in a web environment.
 */
export declare class SmartWeaveWebFactory {
    /**
     * Returns a fully configured {@link SmartWeave} that is using remote cache for all layers.
     * See {@link RemoteBlockHeightCache} for details.
     */
    static remoteCached(arweave: Arweave, cacheBaseURL: string): SmartWeave;
    /**
     * Returns a preconfigured, remoteCached {@link SmartWeaveBuilder}, that allows for customization of the SmartWeave instance.
     * Use {@link SmartWeaveBuilder.build()} to finish the configuration.
     */
    static remoteCacheBased(arweave: Arweave, cacheBaseURL: string): SmartWeaveBuilder;
    /**
     * Returns a fully configured {@link SmartWeave} that is using mem cache for all layers.
     */
    static memCached(arweave: Arweave, maxStoredBlockHeights?: number): SmartWeave;
    /**
     * Returns a preconfigured, memCached {@link SmartWeaveBuilder}, that allows for customization of the SmartWeave instance.
     * Use {@link SmartWeaveBuilder.build()} to finish the configuration.
     */
    static memCachedBased(arweave: Arweave, maxStoredBlockHeights?: number, stateCache?: MemBlockHeightSwCache<StateCache<unknown>>): SmartWeaveBuilder;
}
//# sourceMappingURL=SmartWeaveWebFactory.d.ts.map