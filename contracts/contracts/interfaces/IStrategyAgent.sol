// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IStrategyAgent {
    struct StrategyInfo {
        bytes32 id;
        string name;
        string description;
        address[] supportedTokens;
        uint256 minInvestment;
        bytes32 riskLevel;
        uint256 performanceFee;
        bool active;
        address implementation;
    }

    function initialize(bytes calldata data) external;

    function execute(bytes calldata data) external returns (bool success);

    function validate(bytes calldata data) external view returns (bool valid);

    function entryPosition(
        address token,
        uint256 amount
    ) external returns (uint256 positionId);

    function exitPosition(uint256 positionId) external returns (bool success);

    function rebalancePosition(
        uint256 positionId,
        bytes calldata data
    ) external returns (bool success);

    function getAPY() external view returns (uint256 apy);

    function getTVL() external view returns (uint256 tvl);

    function getRiskScore() external view returns (uint256 riskScore);

    function getStrategyInfo() external view returns (StrategyInfo memory info);

    event PositionOpened(
        uint256 indexed positionId,
        address indexed owner,
        address token,
        uint256 amount
    );

    event PositionClosed(
        uint256 indexed positionId,
        address indexed owner,
        uint256 returnAmount
    );

    event PositionRebalanced(uint256 indexed positionId, address indexed owner);

    event StrategyExecuted(
        address indexed executor,
        bytes32 operationType,
        bool success
    );
}
