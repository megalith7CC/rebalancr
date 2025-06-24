// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IAgentRegistry {
    struct AgentInfo {
        bytes32 agentType;
        bool isActive;
        bytes32[] permissions;
        uint256 registeredAt;
        address owner;
    }

    function registerAgent(
        address agentAddress,
        bytes32 agentType
    ) external returns (bool success);

    function deregisterAgent(
        address agentAddress
    ) external returns (bool success);

    function isAuthorized(
        address agentAddress,
        bytes32 actionType
    ) external view returns (bool isAuthorized);

    function updateAgentPermissions(
        address agentAddress,
        bytes32[] calldata permissions
    ) external;

    function getAgentInfo(
        address agentAddress
    ) external view returns (AgentInfo memory agent);

    function getRegisteredAgents()
        external
        view
        returns (address[] memory agents);

    function getAgentsByType(
        bytes32 agentType
    ) external view returns (address[] memory agents);

    function getAgentOwner(
        address agentAddress
    ) external view returns (address owner);

    function transferAgentOwnership(
        address agentAddress,
        address newOwner
    ) external returns (bool success);

    event AgentRegistered(
        address indexed agentAddress,
        bytes32 indexed agentType,
        address indexed owner
    );

    event AgentDeregistered(address indexed agentAddress);

    event AgentPermissionsUpdated(
        address indexed agentAddress,
        bytes32[] permissions
    );

    event AgentOwnershipTransferred(
        address indexed agentAddress,
        address indexed previousOwner,
        address indexed newOwner
    );

    event AgentStatusChanged(address indexed agentAddress, bool isActive);
}
