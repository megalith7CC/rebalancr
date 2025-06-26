import { type Provider, type State, type Memory, type IAgentRuntime } from "@elizaos/core";
import { ethers } from "ethers";
import { StrategyRouterABI } from "../../generated/generated/abis/StrategyRouter";

// Cache TTL in milliseconds (10 minutes)
const CACHE_TTL = 10 * 60 * 1000;

// Cache storage
const strategyCache = {
  data: null,
  timestamp: 0
};

/**
 * StrategyProvider fetches current strategy parameters and performance metrics
 * from the StrategyRouter contract
 */
const strategyProvider: Provider = {
  name: "strategy",
  description: "Provides current strategy parameters and performance metrics",
  position: 20,
  
  async get(runtime: IAgentRuntime, message: Memory, state: State) {
    try {
      // Get blockchain provider configuration from runtime settings
      const rpcUrl = runtime.getSetting("rpcUrl") as string;
      const strategyRouterAddress = runtime.getSetting("strategyRouterAddress") as string;
      const forceRefresh = message.content?.refreshStrategies === true;
      
      if (!rpcUrl || !strategyRouterAddress) {
        throw new Error("Missing configuration: RPC URL or contract address not provided");
      }
      
      // Check cache first if not forcing refresh
      const now = Date.now();
      if (!forceRefresh && strategyCache.data && (now - strategyCache.timestamp < CACHE_TTL)) {
        console.log('Using cached strategy data');
        return strategyCache.data;
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
      const router = new ethers.Contract(
        strategyRouterAddress,
        StrategyRouterABI,
        provider
      );
      
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
      
      // Get active strategies
      const activeStrategies = await fetchWithTimeout(
        router.getActiveStrategies(),
        15000,
        'Strategy list request timed out'
      );
      
      // Get info for each strategy
      const strategiesInfo = await Promise.all(
        activeStrategies.map(async (strategy) => {
          const info = await router.getStrategyInfo(strategy);
          const parameters = await router.getStrategyParameters(strategy);
          
          // Parse parameters based on strategy type (simplified example)
          let parsedParams = {};
          try {
            // This is a simplified example - in reality, we would use the ABI for each strategy type
            // to decode the parameters properly
            if (info.name.includes("Aave")) {
              // Example parsing for Aave strategy parameters
              parsedParams = {
                reserveAsset: "0x" + parameters.slice(26, 66),
                targetLTV: parseInt(parameters.slice(66, 130), 16) / 100,
                rebalanceThreshold: parseInt(parameters.slice(130, 194), 16) / 100,
              };
            } else if (info.name.includes("Balancer")) {
              // Example parsing for Balancer strategy parameters
              parsedParams = {
                poolId: "0x" + parameters.slice(26, 66),
                tokens: ["0x" + parameters.slice(90, 130), "0x" + parameters.slice(154, 194)],
                weights: [
                  parseInt(parameters.slice(194, 258), 16) / 100,
                  parseInt(parameters.slice(258, 322), 16) / 100,
                ],
              };
            } else {
              // Generic parameter representation for other strategies
              parsedParams = { rawParameters: parameters };
            }
          } catch (e) {
            parsedParams = { error: "Failed to parse parameters", raw: parameters };
          }
          
          return {
            address: strategy,
            name: info.name,
            description: info.description,
            tvl: ethers.formatUnits(info.tvl, 18),
            currentApy: (Number(info.currentApy) / 10000).toFixed(2) + "%",
            historicalApy: (Number(info.historicalApy) / 10000).toFixed(2) + "%",
            riskScore: Number(info.riskScore) / 100,
            isActive: info.isActive,
            parameters: parsedParams,
          };
        })
      );
      
      // Find best performing strategy
      const bestStrategy = strategiesInfo.reduce(
        (best, strategy) => 
          parseFloat(strategy.currentApy) > parseFloat(best.currentApy) ? strategy : best,
        strategiesInfo[0]
      );
      
      // Find safest strategy
      const safestStrategy = strategiesInfo.reduce(
        (safest, strategy) => 
          strategy.riskScore < safest.riskScore ? strategy : safest,
        strategiesInfo[0]
      );
      
      // Generate strategy overview text
      const strategyOverview = `Currently tracking ${strategiesInfo.length} active strategies. 
Best performing: ${bestStrategy.name} (${bestStrategy.currentApy}). 
Safest option: ${safestStrategy.name} (risk score: ${safestStrategy.riskScore}).`;
      
      const result = {
        values: {
          strategyOverview,
          bestStrategy: bestStrategy.name,
          bestStrategyApy: bestStrategy.currentApy,
          safestStrategy: safestStrategy.name,
          safestStrategyRisk: safestStrategy.riskScore,
          activeStrategiesCount: strategiesInfo.length,
          lastUpdated: new Date().toISOString()
        },
        data: {
          strategy: {
            strategies: strategiesInfo,
            bestPerforming: bestStrategy,
            safest: safestStrategy,
            timestamp: Date.now(),
            available: true,
          }
        },
        text: strategyOverview
      };
      
      // Update cache
      strategyCache.data = result;
      strategyCache.timestamp = now;
      
      return result;
    } catch (error) {
      console.error("Error in strategyProvider:", error);
      
      // Structured error handling
      const errorCode = error.code || 'UNKNOWN_ERROR';
      const errorMessage = error.message || "Unknown error in strategy provider";
      
      // Provide more helpful messages based on error types
      let userFriendlyMessage = "Unable to retrieve current strategy data. Please try again later.";
      
      if (error.message?.includes('missing configuration')) {
        userFriendlyMessage = 'Strategy data service is not properly configured. Please contact support.';
      } else if (error.message?.includes('connection failed') || error.code === 'NETWORK_ERROR') {
        userFriendlyMessage = 'Unable to connect to blockchain network. Please check your connection and try again.';
      } else if (error.message?.includes('timed out')) {
        userFriendlyMessage = 'Strategy data request timed out. The service might be experiencing high load.';
      }
      
      return {
        values: {
          strategyError: errorMessage,
          strategyErrorCode: errorCode,
          strategyAvailable: false,
        },
        data: {
          strategy: {
            error: errorMessage,
            errorCode,
            available: false,
            timestamp: Date.now(),
          }
        },
        text: userFriendlyMessage
      };
    }
  }
};

export default strategyProvider; 