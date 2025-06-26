import { type Provider, type State, type Memory, type IAgentRuntime } from "@elizaos/core";
import { ethers } from "ethers";
import { PositionManagerABI } from "../../generated/generated/abis/PositionManager";

// Cache TTL in milliseconds (3 minutes)
const CACHE_TTL = 3 * 60 * 1000;

// Cache storage
const positionCache = {
  data: {},
  timestamp: {}
};

/**
 * PositionProvider fetches user position data from the PositionManager contract
 * This provider monitors position status, health metrics, and allocation details
 */
const positionProvider: Provider = {
  name: "position",
  description: "Provides user position data and health metrics",
  position: 30,
  
  async get(runtime: IAgentRuntime, message: Memory, state: State) {
    try {
      // Get blockchain provider configuration from runtime settings
      const rpcUrl = runtime.getSetting("rpcUrl") as string;
      const positionManagerAddress = runtime.getSetting("positionManagerAddress") as string;
      
      // Get user address from message or state if available
      let userAddress = message.content?.userAddress as string;
      if (!userAddress && state.values.userAddress) {
        userAddress = state.values.userAddress as string;
      }
      
      if (!rpcUrl || !positionManagerAddress) {
        throw new Error("Missing configuration: RPC URL or contract address not provided");
      }
      
      // Check cache if we have a user address and not forcing refresh
      const now = Date.now();
      const forceRefresh = message.content?.refreshPositions === true;
      
      if (userAddress && !forceRefresh && 
          positionCache.data[userAddress] && 
          positionCache.timestamp[userAddress] && 
          (now - positionCache.timestamp[userAddress] < CACHE_TTL)) {
        console.log(`Using cached position data for ${userAddress}`);
        return positionCache.data[userAddress];
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
      const positionManager = new ethers.Contract(
        positionManagerAddress,
        PositionManagerABI,
        provider
      );
      
      let positionData;
      let positionText;
      
      if (userAddress) {
        // Fetch with timeout protection
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
        
        // Get user's positions
        const positionIds = await fetchWithTimeout(
          positionManager.getUserPositions(userAddress),
          15000,
          'Position retrieval request timed out'
        );
        
        if (positionIds.length === 0) {
          positionText = `No active positions found for the user address ${userAddress}.`;
          positionData = {
            userAddress,
            positions: [],
            count: 0,
            totalValue: "0",
            available: true,
          };
        } else {
          // Get details for each position
          const positions = await Promise.all(
            positionIds.map(async (positionId) => {
              const details = await positionManager.getPositionDetails(positionId);
              const allocations = await positionManager.getPositionAllocations(positionId);
              
              // Process allocations
              const processedAllocations = allocations.map(allocation => ({
                asset: allocation.asset,
                amount: ethers.formatUnits(allocation.amount, 18),
                weight: Number(allocation.weight) / 10000, // Assuming weights are in basis points
              }));
              
              return {
                id: positionId.toString(),
                owner: details.owner,
                strategy: details.strategy,
                amount: ethers.formatUnits(details.amount, 18),
                entryTimestamp: new Date(Number(details.entryTimestamp) * 1000).toISOString(),
                lastUpdateTimestamp: new Date(Number(details.lastUpdateTimestamp) * 1000).toISOString(),
                entryValue: ethers.formatUnits(details.entryValue, 18),
                currentValue: ethers.formatUnits(details.currentValue, 18),
                healthFactor: Number(details.healthFactor) / 100,
                active: details.active,
                allocations: processedAllocations,
                performancePct: (
                  (Number(ethers.formatUnits(details.currentValue, 18)) / 
                   Number(ethers.formatUnits(details.entryValue, 18)) - 1) * 100
                ).toFixed(2) + "%",
              };
            })
          );
          
          // Calculate total value across all positions
          const totalValue = positions.reduce(
            (sum, position) => sum + parseFloat(position.currentValue),
            0
          ).toFixed(2);
          
          // Find positions with concerning health factors
          const unhealthyPositions = positions.filter(p => p.healthFactor < 0.8);
          
          positionData = {
            userAddress,
            positions,
            count: positions.length,
            totalValue,
            unhealthyCount: unhealthyPositions.length,
            available: true,
          };
          
          // Generate position overview text
          positionText = `User has ${positions.length} active positions with total value of ${totalValue} ETH. `;
          
          if (unhealthyPositions.length > 0) {
            positionText += `WARNING: ${unhealthyPositions.length} position(s) have concerning health factors.`;
          } else {
            positionText += `All positions are currently in good health.`;
          }
        }
        
        // Cache the result
        const result = {
          values: {
            positionOverview: positionText,
            userAddress: userAddress,
            positionCount: positionData.count || 0,
            totalValue: positionData.totalValue || "0",
          },
          data: {
            position: positionData
          },
          text: positionText
        };
        
        // Update cache
        positionCache.data[userAddress] = result;
        positionCache.timestamp[userAddress] = now;
        
        return result;
      } else {
        // No user address provided, return general system stats
        positionText = "No specific user address provided for position data.";
        positionData = {
          error: "No user address specified",
          available: false,
        };
        
        return {
          values: {
            positionOverview: positionText,
            userAddress: null,
            positionCount: 0,
            totalValue: "0",
          },
          data: {
            position: positionData
          },
          text: positionText
        };
      }
    } catch (error) {
      console.error("Error in positionProvider:", error);
      
      // Structured error handling
      const errorCode = error.code || 'UNKNOWN_ERROR';
      const errorMessage = error.message || "Unknown error in position provider";
      
      // Provide more helpful messages based on error types
      let userFriendlyMessage = "Unable to retrieve position data. Please try again later.";
      
      if (error.message?.includes('missing configuration')) {
        userFriendlyMessage = 'Position data service is not properly configured. Please contact support.';
      } else if (error.message?.includes('connection failed') || error.code === 'NETWORK_ERROR') {
        userFriendlyMessage = 'Unable to connect to blockchain network. Please check your connection and try again.';
      } else if (error.message?.includes('timed out')) {
        userFriendlyMessage = 'Position data request timed out. The service might be experiencing high load.';
      }
      
      return {
        values: {
          positionError: errorMessage,
          positionErrorCode: errorCode,
          positionAvailable: false,
        },
        data: {
          position: {
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

export default positionProvider; 