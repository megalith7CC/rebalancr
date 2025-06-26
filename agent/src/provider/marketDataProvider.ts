import { type Provider, type State, type Memory, type IAgentRuntime } from '@elizaos/core';
import { ethers } from 'ethers';
import { MarketDataAggregatorABI } from '@rebalancr/abis/MarketDataAggregator';

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Cache storage
const dataCache = {
	data: null,
	timestamp: 0
};

/**
 * MarketDataProvider fetches yield data from various DeFi protocols
 * through the MarketDataAggregator contract
 */
const marketDataProvider: Provider = {
	name: 'marketData',
	description: 'Provides current yield data from DeFi protocols',
	position: 10, // Higher priority position

	async get(runtime: IAgentRuntime, message: Memory, state: State) {
		try {
			// Get blockchain provider configuration from runtime settings
			const rpcUrl = runtime.getSetting('rpcUrl') as string;
			const marketDataAggregatorAddress = runtime.getSetting('marketDataAggregatorAddress') as string;
			const forceRefresh = message.content?.refreshMarketData === true;

			if (!rpcUrl || !marketDataAggregatorAddress) {
				throw new Error('Missing configuration: RPC URL or contract address not provided');
			}

			// Check cache first if not forcing refresh
			const now = Date.now();
			if (!forceRefresh && dataCache.data && (now - dataCache.timestamp < CACHE_TTL)) {
				console.log('Using cached market data');
				return dataCache.data;
			}

			// Connect to provider with retry logic
			let provider;
			try {
				provider = new ethers.JsonRpcProvider(rpcUrl);
				await provider.getBlockNumber(); // Test the connection
			} catch (connectionError) {
				console.error('Failed to connect to RPC provider:', connectionError);
				throw new Error(`Blockchain connection failed: ${connectionError.message || 'Unknown error'}`);
			}

			// Connect to the contract
			const aggregator = new ethers.Contract(marketDataAggregatorAddress, MarketDataAggregatorABI, provider);

			// Fetch data from the contract with timeout protection
			const fetchWithTimeout = async (promise, timeoutMs = 10000, errorMessage = 'Request timed out') => {
				let timeoutId;
				const timeoutPromise = new Promise((_, reject) => {
					timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
				});
				
				try {
					const result = await Promise.race([promise, timeoutPromise]);
					clearTimeout(timeoutId);
					return result;
				} catch (error) {
					clearTimeout(timeoutId);
					throw error;
				}
			};

			// Fetch data with timeout protection
			const [protocolYields, marketSummary] = await Promise.all([
				fetchWithTimeout(aggregator.getProtocolYields(), 15000, 'Protocol yields request timed out'),
				fetchWithTimeout(aggregator.getLatestMarketSummary(), 15000, 'Market summary request timed out')
			]);

			// Process protocol yields data
			const yieldData = protocolYields.map((protocol) => ({
				name: protocol.name,
				apy: (Number(protocol.apy) / 10000).toFixed(2) + '%', // Assuming APY is stored with 2 decimal precision
				tvl: ethers.formatUnits(protocol.tvl, 18),
				risk: Number(protocol.risk) / 100, // Assuming risk is on a scale of 0-100
			}));

			// Process market summary
			const summary = {
				timestamp: new Date(Number(marketSummary.timestamp) * 1000).toISOString(),
				sentiment: marketSummary.sentiment,
				volatilityIndex: Number(marketSummary.volatilityIndex) / 100,
			};

			// Find highest yield protocol
			const highestYield = yieldData.reduce(
				(max, protocol) => (parseFloat(protocol.apy) > parseFloat(max.apy) ? protocol : max),
				yieldData[0],
			);

			// Find lowest risk protocol
			const lowestRisk = yieldData.reduce((min, protocol) => (protocol.risk < min.risk ? protocol : min), yieldData[0]);

			// Generate market overview text
			const marketOverview = `Current market sentiment is ${summary.sentiment} with volatility index at ${summary.volatilityIndex}. 
Highest yield: ${highestYield.name} at ${highestYield.apy}. 
Lowest risk: ${lowestRisk.name} with risk score ${lowestRisk.risk}.`;

			const result = {
				values: {
					marketOverview,
					highestYield: highestYield.name,
					highestYieldRate: highestYield.apy,
					lowestRisk: lowestRisk.name,
					marketSentiment: summary.sentiment,
					volatilityIndex: summary.volatilityIndex,
					lastUpdated: summary.timestamp,
				},
				data: {
					marketData: {
						protocols: yieldData,
						summary,
						timestamp: Date.now(),
						available: true,
					},
				},
				text: marketOverview,
			};

			// Update cache
			dataCache.data = result;
			dataCache.timestamp = now;

			return result;
		} catch (error) {
			console.error('Error in marketDataProvider:', error);
			
			// Structured error handling
			const errorCode = error.code || 'UNKNOWN_ERROR';
			const errorMessage = error.message || 'Unknown error in market data provider';
			
			// Provide more helpful messages based on error types
			let userFriendlyMessage = 'Unable to retrieve current market data. Please try again later.';
			
			if (error.message?.includes('missing configuration')) {
				userFriendlyMessage = 'Market data service is not properly configured. Please contact support.';
			} else if (error.message?.includes('connection failed') || error.code === 'NETWORK_ERROR') {
				userFriendlyMessage = 'Unable to connect to blockchain network. Please check your connection and try again.';
			} else if (error.message?.includes('timed out')) {
				userFriendlyMessage = 'Market data request timed out. The service might be experiencing high load.';
			}
			
			return {
				values: {
					marketDataError: errorMessage,
					marketDataErrorCode: errorCode,
					marketDataAvailable: false,
				},
				data: {
					marketData: {
						error: errorMessage,
						errorCode,
						available: false,
						timestamp: Date.now(),
					},
				},
				text: userFriendlyMessage,
			};
		}
	},
};

export default marketDataProvider;
