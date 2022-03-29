"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartWeaveWebFactory = void 0;
const plugins_1 = require("../../plugins/index");
const core_1 = require("../index");
const cache_1 = require("../../cache/index");
/**
 * A factory that simplifies the process of creating different versions of {@link SmartWeave}.
 * All versions use the {@link Evolve} plugin.
 * SmartWeave instances created by this factory can be safely used in a web environment.
 */
class SmartWeaveWebFactory {
    /**
     * Returns a fully configured {@link SmartWeave} that is using remote cache for all layers.
     * See {@link RemoteBlockHeightCache} for details.
     */
    static remoteCached(arweave, cacheBaseURL) {
        return this.remoteCacheBased(arweave, cacheBaseURL).build();
    }
    /**
     * Returns a preconfigured, remoteCached {@link SmartWeaveBuilder}, that allows for customization of the SmartWeave instance.
     * Use {@link SmartWeaveBuilder.build()} to finish the configuration.
     */
    static remoteCacheBased(arweave, cacheBaseURL) {
        const definitionLoader = new core_1.ContractDefinitionLoader(arweave, new cache_1.MemCache());
        const interactionsLoader = new plugins_1.CacheableContractInteractionsLoader(new core_1.ArweaveGatewayInteractionsLoader(arweave), new cache_1.RemoteBlockHeightCache('INTERACTIONS', cacheBaseURL));
        const executorFactory = new plugins_1.CacheableExecutorFactory(arweave, new core_1.HandlerExecutorFactory(arweave), new cache_1.MemCache());
        const stateEvaluator = new core_1.CacheableStateEvaluator(arweave, new cache_1.RemoteBlockHeightCache('STATE', cacheBaseURL), [new plugins_1.Evolve(definitionLoader, executorFactory)]);
        const interactionsSorter = new core_1.LexicographicalInteractionsSorter(arweave);
        return core_1.SmartWeave.builder(arweave)
            .setDefinitionLoader(definitionLoader)
            .setInteractionsLoader(interactionsLoader)
            .setInteractionsSorter(interactionsSorter)
            .setExecutorFactory(executorFactory)
            .setStateEvaluator(stateEvaluator);
    }
    /**
     * Returns a fully configured {@link SmartWeave} that is using mem cache for all layers.
     */
    static memCached(arweave, maxStoredBlockHeights = 10) {
        return this.memCachedBased(arweave, maxStoredBlockHeights).build();
    }
    /**
     * Returns a preconfigured, memCached {@link SmartWeaveBuilder}, that allows for customization of the SmartWeave instance.
     * Use {@link SmartWeaveBuilder.build()} to finish the configuration.
     */
    static memCachedBased(arweave, maxStoredBlockHeights = 10, stateCache) {
        const definitionLoader = new core_1.ContractDefinitionLoader(arweave, new cache_1.MemCache());
        const interactionsLoader = new core_1.ArweaveGatewayInteractionsLoader(arweave);
        const executorFactory = new plugins_1.CacheableExecutorFactory(arweave, new core_1.HandlerExecutorFactory(arweave), new cache_1.MemCache());
        const stateEvaluator = new core_1.CacheableStateEvaluator(arweave, stateCache ? stateCache : new cache_1.MemBlockHeightSwCache(maxStoredBlockHeights), [new plugins_1.Evolve(definitionLoader, executorFactory)]);
        const interactionsSorter = new core_1.LexicographicalInteractionsSorter(arweave);
        return core_1.SmartWeave.builder(arweave)
            .setDefinitionLoader(definitionLoader)
            .setCacheableInteractionsLoader(interactionsLoader)
            .setInteractionsSorter(interactionsSorter)
            .setExecutorFactory(executorFactory)
            .setStateEvaluator(stateEvaluator);
    }
}
exports.SmartWeaveWebFactory = SmartWeaveWebFactory;
//# sourceMappingURL=SmartWeaveWebFactory.js.map