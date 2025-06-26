// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '../libraries/InputValidation.sol';



contract StrategyPoke is AutomationCompatibleInterface, Ownable {
	event AgentCheckRequested(bytes32 indexed strategyId, uint256 timestamp);
	event StrategyRegistered(bytes32 indexed strategyId, uint256 checkInterval);
	event StrategyDeregistered(bytes32 indexed strategyId);
	event CheckIntervalUpdated(bytes32 indexed strategyId, uint256 newInterval);

	error StrategyNotRegistered(bytes32 strategyId);
	error StrategyAlreadyRegistered(bytes32 strategyId);
	error InvalidCheckInterval(uint256 interval);

	struct StrategyConfig {
		bool active;
		uint256 checkInterval; 
		uint256 lastCheckTime;
	}

	mapping(bytes32 => StrategyConfig) public strategies;
	bytes32[] public activeStrategies;

	uint256 public constant MIN_CHECK_INTERVAL = 300; 
	uint256 public constant MAX_CHECK_INTERVAL = 86400; 

	constructor() Ownable(msg.sender) {}

	

	function registerStrategy(bytes32 strategyId, uint256 checkInterval) external onlyOwner {
		InputValidation.validateNotEmpty(strategyId, 'strategyId');

		if (strategies[strategyId].active) {
			revert StrategyAlreadyRegistered(strategyId);
		}

		if (checkInterval < MIN_CHECK_INTERVAL || checkInterval > MAX_CHECK_INTERVAL) {
			revert InvalidCheckInterval(checkInterval);
		}

		strategies[strategyId] = StrategyConfig({active: true, checkInterval: checkInterval, lastCheckTime: block.timestamp});

		activeStrategies.push(strategyId);

		emit StrategyRegistered(strategyId, checkInterval);
	}

	

	function deregisterStrategy(bytes32 strategyId) external onlyOwner {
		if (!strategies[strategyId].active) {
			revert StrategyNotRegistered(strategyId);
		}

		strategies[strategyId].active = false;

		for (uint256 i = 0; i < activeStrategies.length; i++) {
			if (activeStrategies[i] == strategyId) {
				activeStrategies[i] = activeStrategies[activeStrategies.length - 1];
				activeStrategies.pop();
				break;
			}
		}

		emit StrategyDeregistered(strategyId);
	}

	

	function updateCheckInterval(bytes32 strategyId, uint256 newInterval) external onlyOwner {
		if (!strategies[strategyId].active) {
			revert StrategyNotRegistered(strategyId);
		}

		if (newInterval < MIN_CHECK_INTERVAL || newInterval > MAX_CHECK_INTERVAL) {
			revert InvalidCheckInterval(newInterval);
		}

		strategies[strategyId].checkInterval = newInterval;

		emit CheckIntervalUpdated(strategyId, newInterval);
	}

	

	function poke(bytes32 strategyId) external {
		if (!strategies[strategyId].active) {
			revert StrategyNotRegistered(strategyId);
		}

		strategies[strategyId].lastCheckTime = block.timestamp;

		emit AgentCheckRequested(strategyId, block.timestamp);
	}

	

	function checkUpkeep(
		bytes calldata 
	) external view override returns (bool upkeepNeeded, bytes memory performData) {
		bytes32[] memory strategiesToCheck = new bytes32[](activeStrategies.length);
		uint256 count = 0;

		for (uint256 i = 0; i < activeStrategies.length; i++) {
			bytes32 strategyId = activeStrategies[i];
			StrategyConfig memory config = strategies[strategyId];

			if (config.active && block.timestamp >= config.lastCheckTime + config.checkInterval) {
				strategiesToCheck[count] = strategyId;
				count++;
			}
		}

		if (count > 0) {
			bytes32[] memory result = new bytes32[](count);
			for (uint256 i = 0; i < count; i++) {
				result[i] = strategiesToCheck[i];
			}

			upkeepNeeded = true;
			performData = abi.encode(result);
		}
	}

	

	function performUpkeep(bytes calldata performData) external override {
		bytes32[] memory strategiesToCheck = abi.decode(performData, (bytes32[]));

		for (uint256 i = 0; i < strategiesToCheck.length; i++) {
			bytes32 strategyId = strategiesToCheck[i];
			StrategyConfig storage config = strategies[strategyId];

			if (config.active && block.timestamp >= config.lastCheckTime + config.checkInterval) {
				config.lastCheckTime = block.timestamp;
				emit AgentCheckRequested(strategyId, block.timestamp);
			}
		}
	}

	

	function getActiveStrategies() external view returns (bytes32[] memory) {
		return activeStrategies;
	}

	

	function getStrategyConfig(bytes32 strategyId) external view returns (StrategyConfig memory config) {
		return strategies[strategyId];
	}

	

	function needsCheck(bytes32 strategyId) external view returns (bool) {
		StrategyConfig memory config = strategies[strategyId];
		return config.active && block.timestamp >= config.lastCheckTime + config.checkInterval;
	}
}
