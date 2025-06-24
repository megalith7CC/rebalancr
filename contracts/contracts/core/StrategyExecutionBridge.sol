// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../interfaces/IStrategyExecutionBridge.sol";
import "../interfaces/IStrategyRouter.sol";
import "../interfaces/IAgentRegistry.sol";
import "../libraries/InputValidation.sol";

contract StrategyExecutionBridge is
    IStrategyExecutionBridge,
    Ownable,
    ReentrancyGuard
{
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using InputValidation for address;
    using InputValidation for uint256;
    using InputValidation for bytes32;
    bytes32 public constant EXECUTE_PERMISSION = bytes32("EXECUTE");
    IStrategyRouter private _strategyRouter;
    IAgentRegistry private _agentRegistry;
    mapping(bytes32 => ExecutionRequest) private _requests;
    EnumerableSet.Bytes32Set private _pendingRequests;
    mapping(address => EnumerableSet.Bytes32Set) private _agentRequests;
    uint256 private _executionGasLimit;
    uint256 private _nextRequestId;

    error Unauthorized(address caller);
    error InvalidRequest();
    error RequestNotFound(bytes32 requestId);
    error RequestAlreadyProcessed(bytes32 requestId);
    error StrategyNotFound(bytes32 strategyId);
    error StrategyExecutionFailed(bytes32 strategyId, bytes reason);
    error ZeroAddress(string param);
    error InvalidGasLimit(uint256 provided, uint256 minimum);
    error ZeroValue(string param);

    struct ExecutionRequest {
        address agentAddress;
        bytes32 strategyId;
        bytes data;
        bool executed;
        bool success;
        bytes result;
        uint256 timestamp;
    }
    
    constructor(
        address strategyRouter,
        address agentRegistry
    ) Ownable(msg.sender) {
        if (strategyRouter == address(0)) revert ZeroAddress("strategyRouter");
        if (agentRegistry == address(0)) revert ZeroAddress("agentRegistry");

        _strategyRouter = IStrategyRouter(strategyRouter);
        _agentRegistry = IAgentRegistry(agentRegistry);
        _executionGasLimit = 500000;
    }

    function executeStrategy(
        bytes32 strategyId,
        bytes calldata data
    ) external nonReentrant returns (bytes32 requestId) {
        if (strategyId == bytes32(0)) revert ZeroValue("strategyId");
        if (data.length == 0) revert InvalidRequest();
        if (!_agentRegistry.isAuthorized(msg.sender, EXECUTE_PERMISSION)) {
            revert Unauthorized(msg.sender);
        }
        if (strategyId == bytes32(0)) revert ZeroValue("strategyId");
        if (data.length == 0) revert InvalidRequest();
        requestId = keccak256(
            abi.encodePacked(
                block.timestamp,
                msg.sender,
                strategyId,
                _nextRequestId++
            )
        );
        _requests[requestId] = ExecutionRequest({
            agentAddress: msg.sender,
            strategyId: strategyId,
            data: data,
            executed: false,
            success: false,
            result: "",
            timestamp: block.timestamp
        });
        _pendingRequests.add(requestId);
        _agentRequests[msg.sender].add(requestId);

        emit ExecutionRequested(requestId, msg.sender, strategyId, data);

        return requestId;
    }

    function processAgentResponse(
        bytes32 requestId,
        bytes calldata agentResponse
    ) external nonReentrant returns (bool success) {
        ExecutionRequest storage request = _requests[requestId];
        if (request.agentAddress == address(0))
            revert RequestNotFound(requestId);
        if (request.executed) revert RequestAlreadyProcessed(requestId);
        if (msg.sender != request.agentAddress) {
            revert Unauthorized(msg.sender);
        }
        request.executed = true;
        try
            _strategyRouter.executeStrategy{gas: _executionGasLimit}(
                request.strategyId,
                abi.encode(request.data, agentResponse)
            )
        returns (bool result) {
            request.success = result;
            request.result = agentResponse;
            success = result;
        } catch (bytes memory reason) {
            request.success = false;
            request.result = reason;
            success = false;
        }
        _pendingRequests.remove(requestId);

        emit ExecutionCompleted(requestId, success, agentResponse);

        return success;
    }

    function validateExecution(
        bytes32 strategyId,
        bytes calldata data
    ) external view returns (bool valid, string memory reason) {
        if (!_agentRegistry.isAuthorized(msg.sender, EXECUTE_PERMISSION)) {
            return (false, "Unauthorized");
        }
        if (strategyId == bytes32(0)) {
            return (false, "Invalid strategy ID");
        }

        if (data.length == 0) {
            return (false, "Empty data");
        }
        return (true, "");
    }

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
        )
    {
        ExecutionRequest storage request = _requests[requestId];

        if (request.agentAddress == address(0))
            revert RequestNotFound(requestId);

        return (
            request.agentAddress,
            request.strategyId,
            request.data,
            request.executed,
            request.success,
            request.result
        );
    }

    function setExecutionGasLimit(uint256 gasLimit) external onlyOwner {
        if (gasLimit < 100000) revert InvalidGasLimit(gasLimit, 100000);

        _executionGasLimit = gasLimit;

        emit ExecutionConfigUpdated(gasLimit);
    }

    function updateStrategyRouter(address strategyRouter) external onlyOwner {
        strategyRouter.validateNotZeroAddress("strategyRouter");
        _strategyRouter = IStrategyRouter(strategyRouter);
    }

    function getExecutionGasLimit() external view returns (uint256) {
        return _executionGasLimit;
    }

    function getPendingRequests() external view returns (bytes32[] memory) {
        uint256 length = _pendingRequests.length();
        bytes32[] memory requestIds = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            requestIds[i] = _pendingRequests.at(i);
        }

        return requestIds;
    }

    function getAgentRequests(
        address agentAddress
    ) external view returns (bytes32[] memory) {
        uint256 length = _agentRequests[agentAddress].length();
        bytes32[] memory requestIds = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            requestIds[i] = _agentRequests[agentAddress].at(i);
        }

        return requestIds;
    }
}
