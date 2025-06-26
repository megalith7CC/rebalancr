import { type Action, type IAgentRuntime, type Memory, type State, type HandlerCallback } from "@elizaos/core";
import { ethers } from "ethers";

/**
 * OptimizeParametersAction adjusts strategy parameters to improve yield performance
 * This action analyzes current market conditions and optimizes strategy configurations
 */
const optimizeParametersAction: Action = {
  name: "OPTIMIZE_PARAMETERS",
  description: "Adjust strategy parameters to optimize for current market conditions and improve yields",
  
  similes: [
    "tune strategy settings",
    "adjust yield parameters",
    "optimize strategy configuration",
    "fine-tune yield settings",
    "calibrate strategy parameters"
  ],
  
  examples: [
    [
      {
        name: "user",
        content: {
          text: "Can you optimize the parameters for my Aave yield strategy?"
        }
      }
    ],
    [
      {
        name: "user",
        content: {
          text: "Adjust the parameters of strategy #42 for current market conditions"
        }
      }
    ],
    [
      {
        name: "user",
        content: {
          text: "Fine-tune my Balancer LP strategy settings"
        }
      }
    ]
  ],
  
  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    // Check if the message is asking about parameter optimization
    const text = message.content.text?.toLowerCase() || "";
    
    const optimizeKeywords = [
      "optimize", "tune", "adjust", "calibrate", "fine-tune",
      "improve", "tweak", "modify", "update", "change"
    ];
    
    const parameterKeywords = [
      "parameter", "setting", "configuration", "option", "value",
      "ratio", "threshold", "weight", "allocation", "level"
    ];
    
    const strategyKeywords = [
      "strategy", "aave", "compound", "balancer", "curve", "yearn",
      "yield", "lending", "liquidity", "farming"
    ];
    
    const hasOptimizeKeyword = optimizeKeywords.some(keyword => text.includes(keyword));
    const hasParameterKeyword = parameterKeywords.some(keyword => text.includes(keyword));
    const hasStrategyKeyword = strategyKeywords.some(keyword => text.includes(keyword));
    
    // Extract strategy ID if present
    const strategyIdMatch = text.match(/strategy\s+#?(\d+)/i) || text.match(/strategy\s+id\s+#?(\d+)/i);
    const hasStrategyId = !!strategyIdMatch;
    
    return (hasOptimizeKeyword && (hasParameterKeyword || hasStrategyKeyword)) || hasStrategyId;
  },
  
  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<void> {
    if (!state) {
      console.error("State is required for OPTIMIZE_PARAMETERS action");
      return;
    }
    
    try {
      // Get blockchain provider configuration from runtime settings
      const rpcUrl = runtime.getSetting("rpcUrl") as string;
      const strategyRouterAddress = runtime.getSetting("strategyRouterAddress") as string;
      const privateKey = runtime.getSetting("executionPrivateKey") as string;
      
      if (!rpcUrl || !strategyRouterAddress || !privateKey) {
        const errorMessage = {
          text: "I'm unable to optimize strategy parameters at the moment due to missing configuration. Please ensure the system is properly configured with blockchain connection details.",
          thought: "Missing required configuration for blockchain interaction."
        };
        
        if (callback) {
          await callback({ ...errorMessage });
        }
        return;
      }
      
      // Extract strategy information from message
      const text = message.content.text?.toLowerCase() || "";
      
      // Check for strategy ID in message
      const strategyIdMatch = text.match(/strategy\s+#?(\d+)/i) || text.match(/strategy\s+id\s+#?(\d+)/i);
      let strategyId = strategyIdMatch ? strategyIdMatch[1] : null;
      
      // Check for strategy name in message
      let strategyName = null;
      const strategyKeywords = ["aave", "compound", "balancer", "curve", "yearn"];
      for (const keyword of strategyKeywords) {
        if (text.includes(keyword)) {
          strategyName = keyword.charAt(0).toUpperCase() + keyword.slice(1);
          break;
        }
      }
      
      // Get strategy data from state
      const strategies = state.data.strategy?.strategies || [];
      let targetStrategy = null;
      
      if (strategyId) {
        // Find strategy by ID
        targetStrategy = strategies.find(s => s.address === strategyId || s.id === strategyId);
      } else if (strategyName) {
        // Find strategy by name
        targetStrategy = strategies.find(s => s.name.toLowerCase().includes(strategyName.toLowerCase()));
      } else if (strategies.length === 1) {
        // If only one strategy, use that
        targetStrategy = strategies[0];
      }
      
      if (!targetStrategy) {
        let responseText = "I need to know which strategy you'd like to optimize. ";
        
        if (strategies.length > 0) {
          responseText += "Available strategies:\n";
          strategies.forEach((s, index) => {
            responseText += `${index + 1}. ${s.name} (ID: ${s.id || s.address})\n`;
          });
          responseText += "\nPlease specify which strategy you'd like to optimize.";
        } else {
          responseText += "No strategies are currently available. Please ensure your strategies are properly configured.";
        }
        
        const errorMessage = {
          text: responseText,
          thought: "No specific strategy identified for parameter optimization."
        };
        
        if (callback) {
          await callback({ ...errorMessage });
        }
        return;
      }
      
      // ABI fragment for the StrategyRouter contract
      const routerAbi = [
        "function getStrategyParameters(address strategy) external view returns (bytes parameters)",
        "function optimizeStrategyParameters(address strategy) external returns (bool)",
        "function getOptimizationRecommendation(address strategy) external view returns (tuple(bool shouldOptimize, uint256 potentialGain, bytes optimizedParameters))",
        "function getOptimizationStatus(address strategy) external view returns (tuple(uint256 lastOptimized, bool inProgress, uint256 cooldownRemaining))",
      ];
      
      // Connect to the blockchain
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const router = new ethers.Contract(strategyRouterAddress, routerAbi, wallet);
      
      const strategyAddress = targetStrategy.address;
      
      // First check if optimization is possible (not in cooldown, not already in progress)
      const optimizationStatus = await router.getOptimizationStatus(strategyAddress);
      
      if (optimizationStatus.inProgress) {
        const statusResponse = {
          text: `Parameter optimization for ${targetStrategy.name} is already in progress. Please wait for the current operation to complete.`,
          thought: `Strategy ${targetStrategy.name} is already being optimized.`
        };
        
        if (callback) {
          await callback(statusResponse);
        }
        return;
      }
      
      if (optimizationStatus.cooldownRemaining > 0) {
        const cooldownMinutes = Math.ceil(Number(optimizationStatus.cooldownRemaining) / 60);
        const statusResponse = {
          text: `The ${targetStrategy.name} strategy was recently optimized and is still in the cooldown period. Please try again in ${cooldownMinutes} minutes.`,
          thought: `Strategy ${targetStrategy.name} is in cooldown for ${cooldownMinutes} more minutes.`
        };
        
        if (callback) {
          await callback(statusResponse);
        }
        return;
      }
      
      // Get optimization recommendation
      const recommendation = await router.getOptimizationRecommendation(strategyAddress);
      
      if (!recommendation.shouldOptimize) {
        const noOptimizeResponse = {
          text: `Analysis indicates that optimizing parameters for the ${targetStrategy.name} strategy is not recommended at this time. The potential gain (${ethers.formatUnits(recommendation.potentialGain, 18)} ETH) does not exceed the optimization threshold.`,
          thought: `Optimization not recommended for ${targetStrategy.name} as potential gain is below threshold.`
        };
        
        if (callback) {
          await callback(noOptimizeResponse);
        }
        return;
      }
      
      // Prepare initial response to inform user that optimization is starting
      const initResponse = {
        text: `Analyzing ${targetStrategy.name} strategy for parameter optimization opportunities...`,
        thought: `Initiating parameter optimization for ${targetStrategy.name} with potential gain of ${ethers.formatUnits(recommendation.potentialGain, 18)} ETH.`
      };
      
      if (callback) {
        await callback(initResponse);
      }
      
      // Execute the optimization transaction
      const tx = await router.optimizeStrategyParameters(strategyAddress);
      
      // Wait for transaction confirmation
      const processingResponse = {
        text: `Parameter optimization transaction submitted (tx: ${tx.hash}). Waiting for confirmation...`,
        thought: `Optimization transaction submitted with hash ${tx.hash}.`
      };
      
      if (callback) {
        await callback(processingResponse);
      }
      
      const receipt = await tx.wait();
      
      // Check if transaction was successful
      if (receipt.status === 1) {
        const successResponse = {
          text: `Successfully optimized parameters for the ${targetStrategy.name} strategy! The transaction has been confirmed (tx: ${tx.hash}).
          
Estimated yield improvement: ${ethers.formatUnits(recommendation.potentialGain, 18)} ETH.

The strategy parameters have been adjusted based on current market conditions to maximize yield. I'll continue to monitor market conditions and recommend further optimizations when beneficial.`,
          thought: `Parameter optimization successful for ${targetStrategy.name}. Transaction confirmed with hash ${tx.hash}.`
        };
        
        if (callback) {
          await callback(successResponse);
        }
      } else {
        const failureResponse = {
          text: `The parameter optimization transaction for ${targetStrategy.name} failed. Please try again later or contact support if the issue persists.`,
          thought: `Optimization transaction failed for ${targetStrategy.name}. Transaction hash: ${tx.hash}.`
        };
        
        if (callback) {
          await callback(failureResponse);
        }
      }
    } catch (error) {
      console.error("Error in OPTIMIZE_PARAMETERS action:", error);
      
      const errorMessage = {
        text: "I encountered an error while attempting to optimize strategy parameters. Please try again later.",
        thought: `Error in parameter optimization: ${error.message}`
      };
      
      if (callback) {
        await callback(errorMessage);
      }
    }
  }
};

export default optimizeParametersAction; 