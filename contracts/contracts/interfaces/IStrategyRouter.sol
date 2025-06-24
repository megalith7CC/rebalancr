// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IStrategyRouter {
    function executeStrategy(
        bytes32 strategyId,
        bytes calldata data
    ) external returns (bool success);

    function registerStrategy(
        bytes32 strategyId,
        address implementation
    ) external returns (bool success);

    function updateStrategy(
        bytes32 strategyId,
        address newImplementation
    ) external returns (bool success);

    function getStrategyImplementation(
        bytes32 strategyId
    ) external view returns (address implementation);

    function getActiveStrategies()
        external
        view
        returns (bytes32[] memory strategyIds);

    function pauseStrategy(bytes32 strategyId) external returns (bool success);

    function unpauseStrategy(
        bytes32 strategyId
    ) external returns (bool success);

    function isStrategyActive(
        bytes32 strategyId
    ) external view returns (bool isActive);

    function validateOperation(
        bytes32 strategyId,
        bytes calldata data
    ) external view returns (bool isValid);

    event StrategyExecuted(
        bytes32 indexed strategyId,
        address indexed executor,
        bool success
    );

    event StrategyRegistered(
        bytes32 indexed strategyId,
        address implementation
    );

    event StrategyUpdated(
        bytes32 indexed strategyId,
        address oldImplementation,
        address newImplementation
    );

    event StrategyStatusChanged(bytes32 indexed strategyId, bool isActive);
}
