// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../interfaces/IStrategyRouter.sol";
import "../interfaces/IStrategyAgent.sol";
import "../interfaces/IAgentRegistry.sol";
import "../libraries/InputValidation.sol";

contract StrategyRouter is IStrategyRouter, Ownable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using InputValidation for address;
    using InputValidation for bytes32;
    
    mapping(bytes32 => address) private _strategyImplementations;
    EnumerableSet.Bytes32Set private _activeStrategies;
    mapping(bytes32 => bool) private _pausedStrategies;
    IAgentRegistry private _agentRegistry;
    bytes32 private constant EXECUTE_PERMISSION = bytes32("EXECUTE");
    bytes32 private constant MANAGE_PERMISSION = bytes32("MANAGE");

    error StrategyNotFound(bytes32 strategyId);
    error StrategyAlreadyRegistered(bytes32 strategyId);
    error StrategyNotActive(bytes32 strategyId);
    error StrategyPaused(bytes32 strategyId);
    error ExecutionFailed(bytes32 strategyId, bytes reason);
    error InvalidImplementation(address implementation);

    constructor(address agentRegistry) Ownable(msg.sender) {
        agentRegistry.validateNotZeroAddress("agentRegistry");
        _agentRegistry = IAgentRegistry(agentRegistry);
    }

    function executeStrategy(
        bytes32 strategyId,
        bytes calldata data
    ) external override nonReentrant returns (bool) {
        strategyId.validateNotEmpty("strategyId");
        if (!isStrategyRegistered(strategyId)) {
            revert StrategyNotFound(strategyId);
        }
        if (!_activeStrategies.contains(strategyId)) {
            revert StrategyNotActive(strategyId);
        }
        if (_pausedStrategies[strategyId]) {
            revert StrategyPaused(strategyId);
        }
        bool isAuthorized = _agentRegistry.isAuthorized(
            msg.sender,
            EXECUTE_PERMISSION
        );
        if (!isAuthorized && msg.sender != owner()) {
            revert Unauthorized(msg.sender);
        }
        address implementation = _strategyImplementations[strategyId];
        (bool success, bytes memory returnData) = implementation.call(
            abi.encodeWithSelector(IStrategyAgent.execute.selector, data)
        );
        if (!success) {
            emit StrategyExecuted(strategyId, msg.sender, false);
            revert ExecutionFailed(strategyId, returnData);
        }

        emit StrategyExecuted(strategyId, msg.sender, true);
        return true;
    }

    function registerStrategy(
        bytes32 strategyId,
        address implementation
    ) external override onlyAuthorizedManager returns (bool) {
        strategyId.validateNotEmpty("strategyId");
        implementation.validateNotZeroAddress("implementation");
        if (isStrategyRegistered(strategyId)) {
            revert StrategyAlreadyRegistered(strategyId);
        }
        _validateImplementation(implementation);
        _strategyImplementations[strategyId] = implementation;
        _activeStrategies.add(strategyId);

        emit StrategyRegistered(strategyId, implementation);
        return true;
    }

    function updateStrategy(
        bytes32 strategyId,
        address newImplementation
    ) external override onlyAuthorizedManager returns (bool) {
        strategyId.validateNotEmpty("strategyId");
        newImplementation.validateNotZeroAddress("newImplementation");
        if (!isStrategyRegistered(strategyId)) {
            revert StrategyNotFound(strategyId);
        }
        _validateImplementation(newImplementation);
        address oldImplementation = _strategyImplementations[strategyId];
        _strategyImplementations[strategyId] = newImplementation;

        emit StrategyUpdated(strategyId, oldImplementation, newImplementation);
        return true;
    }

    function getStrategyImplementation(
        bytes32 strategyId
    ) external view override returns (address) {
        strategyId.validateNotEmpty("strategyId");
        if (!isStrategyRegistered(strategyId)) {
            revert StrategyNotFound(strategyId);
        }

        return _strategyImplementations[strategyId];
    }

    function getActiveStrategies()
        external
        view
        override
        returns (bytes32[] memory)
    {
        uint256 count = _activeStrategies.length();
        bytes32[] memory strategyIds = new bytes32[](count);

        for (uint256 i = 0; i < count; i++) {
            strategyIds[i] = _activeStrategies.at(i);
        }

        return strategyIds;
    }

    function pauseStrategy(
        bytes32 strategyId
    ) external override onlyAuthorizedManager returns (bool) {
        strategyId.validateNotEmpty("strategyId");
        if (!isStrategyRegistered(strategyId)) {
            revert StrategyNotFound(strategyId);
        }
        _pausedStrategies[strategyId] = true;

        emit StrategyStatusChanged(strategyId, false);
        return true;
    }

    function unpauseStrategy(
        bytes32 strategyId
    ) external override onlyAuthorizedManager returns (bool) {
        strategyId.validateNotEmpty("strategyId");
        if (!isStrategyRegistered(strategyId)) {
            revert StrategyNotFound(strategyId);
        }
        _pausedStrategies[strategyId] = false;

        emit StrategyStatusChanged(strategyId, true);
        return true;
    }

    function isStrategyActive(
        bytes32 strategyId
    ) external view override returns (bool) {
        return
            _activeStrategies.contains(strategyId) &&
            !_pausedStrategies[strategyId];
    }

    function validateOperation(
        bytes32 strategyId,
        bytes calldata data
    ) external view override returns (bool) {
        strategyId.validateNotEmpty("strategyId");
        if (!isStrategyRegistered(strategyId)) {
            return false;
        }
        address implementation = _strategyImplementations[strategyId];
        (bool success, bytes memory returnData) = implementation.staticcall(
            abi.encodeWithSelector(IStrategyAgent.validate.selector, data)
        );

        if (!success) {
            return false;
        }

        return abi.decode(returnData, (bool));
    }

    function isStrategyRegistered(
        bytes32 strategyId
    ) public view returns (bool) {
        return _strategyImplementations[strategyId] != address(0);
    }

    function setAgentRegistry(address agentRegistry) external onlyOwner {
        agentRegistry.validateNotZeroAddress("agentRegistry");
        _agentRegistry = IAgentRegistry(agentRegistry);
    }

    function _validateImplementation(address implementation) private view {
        uint256 size;
        assembly {
            size := extcodesize(implementation)
        }

        if (size == 0) {
            revert InvalidImplementation(implementation);
        }
    }

    modifier onlyAuthorizedManager() {
        bool isAuthorized = _agentRegistry.isAuthorized(
            msg.sender,
            MANAGE_PERMISSION
        );
        if (!isAuthorized && msg.sender != owner()) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    error Unauthorized(address caller);
}
