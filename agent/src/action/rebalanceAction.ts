import { type Action, type IAgentRuntime, type Memory, type State, type HandlerCallback } from "@elizaos/core";
import { ethers } from "ethers";

/**
 * RebalanceAction triggers rebalancing operations through the StrategyExecutionBridge
 * This action evaluates positions and executes rebalancing when beneficial
 */
const rebalanceAction: Action = {
  name: "REBALANCE",
  description: "Trigger rebalancing operations for yield optimization through the StrategyExecutionBridge",
  
  similes: [
    "optimize position allocation",
    "adjust strategy weights",
    "rebalance portfolio",
    "update position allocations",
    "reallocate assets"
  ],
  
  examples: [
    [
      {
        name: "user",
        content: {
          text: "Can you rebalance my position to optimize for current market conditions?"
        }
      }
    ],
    [
      {
        name: "user",
        content: {
          text: "Rebalance position #123 for better yields"
        }
      }
    ],
    [
      {
        name: "user",
        content: {
          text: "I want to adjust my strategy allocations based on current market conditions"
        }
      }
    ]
  ],
  
  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    // Check if the message is asking about rebalancing
    const text = message.content.text?.toLowerCase() || "";
    
    const rebalanceKeywords = [
      "rebalance", "reallocate", "adjust", "optimize", "update",
      "redistribute", "shift", "change allocation", "reposition"
    ];
    
    const positionKeywords = [
      "position", "portfolio", "allocation", "strategy", "assets",
      "holdings", "weights", "funds", "investment"
    ];
    
    const hasRebalanceKeyword = rebalanceKeywords.some(keyword => text.includes(keyword));
    const hasPositionKeyword = positionKeywords.some(keyword => text.includes(keyword));
    
    // Extract position ID if present
    const positionIdMatch = text.match(/position\s+#?(\d+)/i) || text.match(/position\s+id\s+#?(\d+)/i);
    const hasPositionId = !!positionIdMatch;
    
    // Position ID alone is enough to validate, otherwise need both keyword types
    return hasPositionId || (hasRebalanceKeyword && hasPositionKeyword);
  },
  
  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<void> {
    if (!state) {
      console.error("State is required for REBALANCE action");
      return;
    }
    
    try {
      // Get blockchain provider configuration from runtime settings
      const rpcUrl = runtime.getSetting("rpcUrl") as string;
      const bridgeAddress = runtime.getSetting("strategyExecutionBridgeAddress") as string;
      const privateKey = runtime.getSetting("executionPrivateKey") as string;
      
      if (!rpcUrl || !bridgeAddress || !privateKey) {
        const errorMessage = {
          text: "I'm unable to perform rebalancing at the moment due to missing configuration. Please ensure the system is properly configured with blockchain connection details.",
          thought: "Missing required configuration for blockchain interaction."
        };
        
        if (callback) {
          await callback({ ...errorMessage });
        }
        return;
      }
      
      // Extract position ID from message if present
      const text = message.content.text?.toLowerCase() || "";
      const positionIdMatch = text.match(/position\s+#?(\d+)/i) || text.match(/position\s+id\s+#?(\d+)/i);
      let positionId = positionIdMatch ? positionIdMatch[1] : null;
      
      // If no position ID in message, check if user has only one position
      if (!positionId && state.data.position?.positions?.length === 1) {
        positionId = state.data.position.positions[0].id;
      }
      
      // If still no position ID, we need to ask the user
      if (!positionId) {
        const errorMessage = {
          text: "I need to know which position you'd like to rebalance. Could you please specify the position ID?",
          thought: "No position ID provided and user has multiple positions or no position data available."
        };
        
        if (callback) {
          await callback({ ...errorMessage });
        }
        return;
      }
      
      // Get position data if available
      const positionData = state.data.position?.positions?.find(p => p.id === positionId);
      const marketData = state.data.marketData;
      const strategyData = state.data.strategy;
      
      if (!positionData) {
        const errorMessage = {
          text: `I couldn't find position #${positionId} in your portfolio. Please check the position ID and try again.`,
          thought: `Position ID ${positionId} not found in user's positions.`
        };
        
        if (callback) {
          await callback({ ...errorMessage });
        }
        return;
      }
      
      // ABI fragment for the StrategyExecutionBridge contract
      const bridgeAbi = [
        "function rebalancePosition(uint256 positionId, bytes calldata executionData) external returns (bool)",
        "function getRebalanceRecommendation(uint256 positionId) external view returns (tuple(bool shouldRebalance, uint256 potentialGain, bytes executionData))",
        "function getRebalancingStatus(uint256 positionId) external view returns (tuple(uint256 lastRebalanced, bool inProgress, uint256 cooldownRemaining))",
      ];
      
      // Connect to the blockchain
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const bridge = new ethers.Contract(bridgeAddress, bridgeAbi, wallet);
      
      // First check if rebalancing is possible (not in cooldown, not already in progress)
      const rebalancingStatus = await bridge.getRebalancingStatus(positionId);
      
      if (rebalancingStatus.inProgress) {
        const statusResponse = {
          text: `Rebalancing for position #${positionId} is already in progress. Please wait for the current operation to complete.`,
          thought: `Position ${positionId} is already being rebalanced.`
        };
        
        if (callback) {
          await callback(statusResponse);
        }
        return;
      }
      
      if (rebalancingStatus.cooldownRemaining > 0) {
        const cooldownMinutes = Math.ceil(Number(rebalancingStatus.cooldownRemaining) / 60);
        const statusResponse = {
          text: `Position #${positionId} was recently rebalanced and is still in the cooldown period. Please try again in ${cooldownMinutes} minutes.`,
          thought: `Position ${positionId} is in cooldown for ${cooldownMinutes} more minutes.`
        };
        
        if (callback) {
          await callback(statusResponse);
        }
        return;
      }
      
      // Get rebalance recommendation from the bridge
      const recommendation = await bridge.getRebalanceRecommendation(positionId);
      
      if (!recommendation.shouldRebalance) {
        const noRebalanceResponse = {
          text: `Analysis indicates that rebalancing position #${positionId} is not recommended at this time. The potential gain (${ethers.formatUnits(recommendation.potentialGain, 18)} ETH) does not exceed the rebalancing threshold.`,
          thought: `Rebalancing not recommended for position ${positionId} as potential gain is below threshold.`
        };
        
        if (callback) {
          await callback(noRebalanceResponse);
        }
        return;
      }
      
      // Prepare initial response to inform user that rebalancing is starting
      const initResponse = {
        text: `Analyzing position #${positionId} for rebalancing opportunities...`,
        thought: `Initiating rebalance for position ${positionId} with potential gain of ${ethers.formatUnits(recommendation.potentialGain, 18)} ETH.`
      };
      
      if (callback) {
        await callback(initResponse);
      }
      
      // Execute the rebalancing transaction
      const tx = await bridge.rebalancePosition(positionId, recommendation.executionData);
      
      // Wait for transaction confirmation
      const processingResponse = {
        text: `Rebalancing transaction submitted (tx: ${tx.hash}). Waiting for confirmation...`,
        thought: `Rebalance transaction submitted with hash ${tx.hash}.`
      };
      
      if (callback) {
        await callback(processingResponse);
      }
      
      const receipt = await tx.wait();
      
      // Check if transaction was successful
      if (receipt.status === 1) {
        const successResponse = {
          text: `Successfully rebalanced position #${positionId}! The transaction has been confirmed (tx: ${tx.hash}).
          
Estimated gain from rebalancing: ${ethers.formatUnits(recommendation.potentialGain, 18)} ETH.

Your position has been optimized based on current market conditions and yield opportunities. I'll continue to monitor your position and recommend further optimizations when beneficial.`,
          thought: `Rebalancing successful for position ${positionId}. Transaction confirmed with hash ${tx.hash}.`
        };
        
        if (callback) {
          await callback(successResponse);
        }
      } else {
        const failureResponse = {
          text: `The rebalancing transaction for position #${positionId} failed. Please try again later or contact support if the issue persists.`,
          thought: `Rebalancing transaction failed for position ${positionId}. Transaction hash: ${tx.hash}.`
        };
        
        if (callback) {
          await callback(failureResponse);
        }
      }
    } catch (error) {
      console.error("Error in REBALANCE action:", error);
      
      const errorMessage = {
        text: "I encountered an error while attempting to rebalance your position. Please try again later.",
        thought: `Error in rebalancing: ${error.message}`
      };
      
      if (callback) {
        await callback(errorMessage);
      }
    }
  }
};

export default rebalanceAction; 