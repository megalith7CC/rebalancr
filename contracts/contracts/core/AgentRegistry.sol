// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../interfaces/IAgentRegistry.sol";
import "../libraries/InputValidation.sol";

contract AgentRegistry is IAgentRegistry, Ownable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using InputValidation for address;
    using InputValidation for bytes32;

    mapping(address => AgentInfo) private _agents;
    EnumerableSet.AddressSet private _registeredAgents;
    mapping(bytes32 => EnumerableSet.AddressSet) private _agentsByType;
    EnumerableSet.Bytes32Set private _globalPermissions;

    error AgentNotRegistered(address agentAddress);
    error AgentAlreadyRegistered(address agentAddress);
    error Unauthorized(address caller);
    error InvalidAgentType(bytes32 agentType);

    constructor() Ownable(msg.sender) {
        _globalPermissions.add(bytes32("VIEW"));
        _globalPermissions.add(bytes32("QUERY"));
    }

    function registerAgent(
        address agentAddress,
        bytes32 agentType
    ) external override onlyOwner returns (bool) {
        agentAddress.validateNotZeroAddress("agentAddress");
        agentType.validateNotEmpty("agentType");

        if (_registeredAgents.contains(agentAddress)) {
            revert AgentAlreadyRegistered(agentAddress);
        }
        uint256 globalPermissionCount = _globalPermissions.length();
        bytes32[] memory initialPermissions = new bytes32[](
            globalPermissionCount
        );

        for (uint256 i = 0; i < globalPermissionCount; i++) {
            initialPermissions[i] = _globalPermissions.at(i);
        }
        _agents[agentAddress] = AgentInfo({
            agentType: agentType,
            isActive: true,
            permissions: initialPermissions,
            registeredAt: block.timestamp,
            owner: msg.sender
        });
        _registeredAgents.add(agentAddress);
        _agentsByType[agentType].add(agentAddress);
        emit AgentRegistered(agentAddress, agentType, msg.sender);

        return true;
    }

    function deregisterAgent(
        address agentAddress
    ) external override nonReentrant returns (bool) {
        agentAddress.validateNotZeroAddress("agentAddress");
        if (!_registeredAgents.contains(agentAddress)) {
            revert AgentNotRegistered(agentAddress);
        }
        AgentInfo storage agentInfo = _agents[agentAddress];
        if (msg.sender != owner() && msg.sender != agentInfo.owner) {
            revert Unauthorized(msg.sender);
        }
        _agentsByType[agentInfo.agentType].remove(agentAddress);
        _registeredAgents.remove(agentAddress);
        emit AgentDeregistered(agentAddress);
        agentInfo.isActive = false;
        emit AgentStatusChanged(agentAddress, false);

        return true;
    }

    function isAuthorized(
        address agentAddress,
        bytes32 actionType
    ) external view override returns (bool) {
        if (agentAddress == address(0) || actionType == bytes32(0)) {
            return false;
        }
        if (
            !_registeredAgents.contains(agentAddress) ||
            !_agents[agentAddress].isActive
        ) {
            return false;
        }
        if (_globalPermissions.contains(actionType)) {
            return true;
        }
        bytes32[] memory permissions = _agents[agentAddress].permissions;
        for (uint256 i = 0; i < permissions.length; i++) {
            if (permissions[i] == actionType) {
                return true;
            }
        }

        return false;
    }

    function updateAgentPermissions(
        address agentAddress,
        bytes32[] calldata permissions
    ) external override {
        agentAddress.validateNotZeroAddress("agentAddress");
        if (!_registeredAgents.contains(agentAddress)) {
            revert AgentNotRegistered(agentAddress);
        }
        AgentInfo storage agentInfo = _agents[agentAddress];
        if (msg.sender != owner() && msg.sender != agentInfo.owner) {
            revert Unauthorized(msg.sender);
        }
        agentInfo.permissions = permissions;
        emit AgentPermissionsUpdated(agentAddress, permissions);
    }

    function addGlobalPermission(bytes32 permission) external onlyOwner {
        permission.validateNotEmpty("permission");
        _globalPermissions.add(permission);
    }

    function removeGlobalPermission(bytes32 permission) external onlyOwner {
        permission.validateNotEmpty("permission");
        _globalPermissions.remove(permission);
    }

    function getGlobalPermissions() external view returns (bytes32[] memory) {
        uint256 count = _globalPermissions.length();
        bytes32[] memory permissions = new bytes32[](count);

        for (uint256 i = 0; i < count; i++) {
            permissions[i] = _globalPermissions.at(i);
        }

        return permissions;
    }

    function getAgentInfo(
        address agentAddress
    ) external view override returns (AgentInfo memory) {
        agentAddress.validateNotZeroAddress("agentAddress");
        if (
            !_registeredAgents.contains(agentAddress) &&
            _agents[agentAddress].registeredAt == 0
        ) {
            revert AgentNotRegistered(agentAddress);
        }

        return _agents[agentAddress];
    }

    function getRegisteredAgents()
        external
        view
        override
        returns (address[] memory)
    {
        uint256 count = _registeredAgents.length();
        address[] memory agents = new address[](count);

        for (uint256 i = 0; i < count; i++) {
            agents[i] = _registeredAgents.at(i);
        }

        return agents;
    }

    function getAgentsByType(
        bytes32 agentType
    ) external view override returns (address[] memory) {
        agentType.validateNotEmpty("agentType");

        EnumerableSet.AddressSet storage agentsOfType = _agentsByType[
            agentType
        ];
        uint256 count = agentsOfType.length();

        address[] memory agents = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            agents[i] = agentsOfType.at(i);
        }

        return agents;
    }

    function getAgentOwner(
        address agentAddress
    ) external view override returns (address) {
        agentAddress.validateNotZeroAddress("agentAddress");
        if (!_registeredAgents.contains(agentAddress)) {
            revert AgentNotRegistered(agentAddress);
        }

        return _agents[agentAddress].owner;
    }

    function transferAgentOwnership(
        address agentAddress,
        address newOwner
    ) external override nonReentrant returns (bool) {
        agentAddress.validateNotZeroAddress("agentAddress");
        newOwner.validateNotZeroAddress("newOwner");
        if (!_registeredAgents.contains(agentAddress)) {
            revert AgentNotRegistered(agentAddress);
        }
        AgentInfo storage agentInfo = _agents[agentAddress];
        if (msg.sender != owner() && msg.sender != agentInfo.owner) {
            revert Unauthorized(msg.sender);
        }
        address previousOwner = agentInfo.owner;
        agentInfo.owner = newOwner;
        emit AgentOwnershipTransferred(agentAddress, previousOwner, newOwner);

        return true;
    }

    function setAgentStatus(
        address agentAddress,
        bool isActive
    ) external nonReentrant returns (bool) {
        agentAddress.validateNotZeroAddress("agentAddress");
        if (!_registeredAgents.contains(agentAddress)) {
            revert AgentNotRegistered(agentAddress);
        }
        AgentInfo storage agentInfo = _agents[agentAddress];
        if (msg.sender != owner() && msg.sender != agentInfo.owner) {
            revert Unauthorized(msg.sender);
        }
        agentInfo.isActive = isActive;
        emit AgentStatusChanged(agentAddress, isActive);

        return true;
    }

    function isAgentRegistered(
        address agentAddress
    ) external view returns (bool) {
        return _registeredAgents.contains(agentAddress);
    }

    function isAgentActive(address agentAddress) external view returns (bool) {
        if (!_registeredAgents.contains(agentAddress)) {
            return false;
        }
        return _agents[agentAddress].isActive;
    }
}
