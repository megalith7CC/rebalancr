import type { Plugin } from '@elizaos/core';
import { logger } from '@elizaos/core';

import { addresses } from '@rebalancr/addresses';

const plugin: Plugin = {
	name: 'plugin-rebalancr',
	description: 'Base plugin for Rebalancr DeFi strategy agent',
	priority: 100,
	config: {
		// Default configuration for development/testing
		rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/demo',
		marketDataAggregatorAddress: addresses.MarketDataAggregator,
		strategyRouterAddress: addresses.StrategyRouter,
		positionManagerAddress: addresses.PositionManager,
		strategyExecutionBridgeAddress: addresses.StrategyExecutionBridge,
	},
	async init(config: Record<string, string>) {
		logger.info('+++++++++++++++++++++++ Rebalancr Plugin Loaded');

		// Override default config with any provided values
		if (config.rpcUrl) {
			this.config.rpcUrl = config.rpcUrl;
		}

		if (config.marketDataAggregatorAddress) {
			this.config.marketDataAggregatorAddress = config.marketDataAggregatorAddress;
		}

		if (config.strategyRouterAddress) {
			this.config.strategyRouterAddress = config.strategyRouterAddress;
		}

		if (config.positionManagerAddress) {
			this.config.positionManagerAddress = config.positionManagerAddress;
		}

		if (config.strategyExecutionBridgeAddress) {
			this.config.strategyExecutionBridgeAddress = config.strategyExecutionBridgeAddress;
		}

		logger.info(`Rebalancr plugin initialized with RPC URL: ${this.config.rpcUrl}`);
		logger.info(`Contract addresses configured: 
      - MarketDataAggregator: ${this.config.marketDataAggregatorAddress}
      - StrategyRouter: ${this.config.strategyRouterAddress}
      - PositionManager: ${this.config.positionManagerAddress}
      - StrategyExecutionBridge: ${this.config.strategyExecutionBridgeAddress}`);
	},
	routes: [],
	events: {},
	services: [],
	actions: [],
	evaluators: [],
	providers: [],
};

export default plugin;
