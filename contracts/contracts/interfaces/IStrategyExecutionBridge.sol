// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IStrategyExecutionBridge {
    event ExecutionRequested(
        bytes32 indexed requestId,
        address indexed agentAddress,
        bytes32 indexed strategyId,
        bytes data
    );

    event ExecutionCompleted(
        bytes32 indexed requestId,
        bool success,
        bytes result
    );

    event ExecutionConfigUpdated(uint256 gasLimit);

    function executeStrategy(
        bytes32 strategyId,
        bytes calldata data
    ) external returns (bytes32 requestId);

    function processAgentResponse(
        bytes32 requestId,
        bytes calldata agentResponse
    ) external returns (bool success);

    function validateExecution(
        bytes32 strategyId,
        bytes calldata data
    ) external view returns (bool valid, string memory reason);

    function getRequestDetails(
        bytes32 requestId
    )
        external
        view
        returns (
            address agentAddress,
            bytes32 strategyId,
            bytes memory data,
            bool executed,
            bool success,
            bytes memory result
        );

    function setExecutionGasLimit(uint256 gasLimit) external;

    function updateStrategyRouter(address strategyRouter) external;
}
