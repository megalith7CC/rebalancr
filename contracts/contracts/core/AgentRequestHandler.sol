// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IAgentRegistry.sol";
import "../libraries/InputValidation.sol";

contract AgentRequestHandler is Ownable, ReentrancyGuard {
    using InputValidation for address;
    using InputValidation for uint256;
    using InputValidation for bytes;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant SUBMIT_REQUEST_PERMISSION =
        keccak256(abi.encodePacked("SUBMIT_REQUEST"));
    bytes32 public constant PROCESS_REQUEST_PERMISSION =
        keccak256(abi.encodePacked("PROCESS_REQUEST"));

    enum RequestStatus {
        Pending,
        Processing,
        Completed,
        Failed,
        Cancelled
    }
    enum RequestPriority {
        Low,
        Medium,
        High,
        Critical
    }
    struct AgentRequest {
        address requester;
        address agentAddress;
        bytes data;
        uint256 timestamp;
        RequestStatus status;
        RequestPriority priority;
        bytes result;
        string errorMessage;
    }
    IAgentRegistry private _agentRegistry;
    uint256 private _requestCount;
    mapping(bytes32 => AgentRequest) private _requests;
    EnumerableSet.Bytes32Set private _pendingRequests;
    EnumerableSet.Bytes32Set private _processingRequests;
    EnumerableSet.Bytes32Set private _completedRequests;
    EnumerableSet.Bytes32Set private _failedRequests;
    EnumerableSet.Bytes32Set private _cancelledRequests;
    mapping(address => EnumerableSet.Bytes32Set) private _requesterRequests;
    mapping(address => EnumerableSet.Bytes32Set) private _agentRequests;
    mapping(address => uint256) private _requestLimits;
    mapping(address => uint256) private _lastRequestTimestamps;
    EnumerableSet.AddressSet private _requesters;
    uint256 private _globalRequestLimit;
    uint256 private _cooldownPeriod;
    event RequestSubmitted(
        bytes32 indexed requestId,
        address indexed requester,
        address indexed agentAddress
    );
    event RequestStatusUpdated(bytes32 indexed requestId, RequestStatus status);
    event RequestProcessed(bytes32 indexed requestId, bool success);
    event RequestLimitUpdated(address indexed agent, uint256 limit);
    event GlobalRequestLimitUpdated(uint256 limit);
    event CooldownPeriodUpdated(uint256 period);
    event AgentRegistryUpdated(
        address indexed oldRegistry,
        address indexed newRegistry
    );
    error Unauthorized(address caller);
    error InvalidRequest();
    error RequestNotFound(bytes32 requestId);
    error RequestAlreadyProcessed(bytes32 requestId);
    error RequestLimitExceeded(address agent, uint256 limit, uint256 current);
    error CooldownPeriodNotElapsed(address agent, uint256 remainingTime);
    error RequestProcessingFailed(bytes32 requestId, string reason);
    error ZeroAddress(string param);
    error ZeroValue(string param);

    constructor(address agentRegistry) Ownable(msg.sender) {
        if (agentRegistry == address(0)) revert ZeroAddress("agentRegistry");
        _agentRegistry = IAgentRegistry(agentRegistry);
        _globalRequestLimit = 1000;
        _cooldownPeriod = 1 minutes;
    }

    function submitRequest(
        address agentAddress,
        bytes calldata data,
        RequestPriority priority
    ) external nonReentrant returns (bytes32 requestId) {
        if (
            !_agentRegistry.isAuthorized(msg.sender, SUBMIT_REQUEST_PERMISSION)
        ) {
            revert Unauthorized(msg.sender);
        }
        if (agentAddress == address(0)) revert ZeroAddress("agentAddress");
        if (data.length == 0) revert InvalidRequest();
        _checkRateLimits(msg.sender);
        requestId = keccak256(
            abi.encodePacked(
                block.timestamp,
                msg.sender,
                agentAddress,
                _requestCount++
            )
        );
        _requests[requestId] = AgentRequest({
            requester: msg.sender,
            agentAddress: agentAddress,
            data: data,
            timestamp: block.timestamp,
            status: RequestStatus.Pending,
            priority: priority,
            result: "",
            errorMessage: ""
        });
        _pendingRequests.add(requestId);
        _requesterRequests[msg.sender].add(requestId);
        _agentRequests[agentAddress].add(requestId);
        _requesters.add(msg.sender);
        _lastRequestTimestamps[msg.sender] = block.timestamp;

        emit RequestSubmitted(requestId, msg.sender, agentAddress);
        return requestId;
    }

    function processRequest(
        bytes32 requestId,
        bytes calldata result,
        bool success
    ) external nonReentrant returns (bool) {
        AgentRequest storage request = _requests[requestId];
        if (request.requester == address(0)) revert RequestNotFound(requestId);
        if (request.status != RequestStatus.Pending)
            revert RequestAlreadyProcessed(requestId);
        if (
            msg.sender != request.agentAddress &&
            !_agentRegistry.isAuthorized(msg.sender, PROCESS_REQUEST_PERMISSION)
        ) {
            revert Unauthorized(msg.sender);
        }
        if (success) {
            request.status = RequestStatus.Completed;
            request.result = result;
            _completedRequests.add(requestId);
        } else {
            request.status = RequestStatus.Failed;
            request.errorMessage = "Processing failed";
            _failedRequests.add(requestId);
        }
        _pendingRequests.remove(requestId);
        _processingRequests.remove(requestId);

        emit RequestStatusUpdated(requestId, request.status);
        emit RequestProcessed(requestId, success);

        return true;
    }

    function cancelRequest(bytes32 requestId) external returns (bool) {
        AgentRequest storage request = _requests[requestId];
        if (request.requester == address(0)) revert RequestNotFound(requestId);
        if (request.status != RequestStatus.Pending)
            revert RequestAlreadyProcessed(requestId);
        if (
            msg.sender != request.requester &&
            msg.sender != request.agentAddress &&
            !_agentRegistry.isAuthorized(msg.sender, PROCESS_REQUEST_PERMISSION)
        ) {
            revert Unauthorized(msg.sender);
        }
        request.status = RequestStatus.Cancelled;
        _pendingRequests.remove(requestId);
        _processingRequests.remove(requestId);
        _cancelledRequests.add(requestId);

        emit RequestStatusUpdated(requestId, RequestStatus.Cancelled);

        return true;
    }

    function getRequest(
        bytes32 requestId
    ) external view returns (AgentRequest memory) {
        AgentRequest memory request = _requests[requestId];
        if (request.requester == address(0)) revert RequestNotFound(requestId);
        return request;
    }

    function getPendingRequests() external view returns (bytes32[] memory) {
        uint256 length = _pendingRequests.length();
        bytes32[] memory requestIds = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            requestIds[i] = _pendingRequests.at(i);
        }

        return requestIds;
    }

    function getRequesterRequests(
        address requester
    ) external view returns (bytes32[] memory) {
        uint256 length = _requesterRequests[requester].length();
        bytes32[] memory requestIds = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            requestIds[i] = _requesterRequests[requester].at(i);
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

    function getNextBatchByPriority(
        uint256 batchSize
    ) external view returns (bytes32[] memory) {
        uint256 pendingCount = _pendingRequests.length();
        uint256 actualSize = batchSize > pendingCount
            ? pendingCount
            : batchSize;

        if (actualSize == 0) {
            return new bytes32[](0);
        }
        bytes32[] memory criticalRequests = new bytes32[](pendingCount);
        bytes32[] memory highRequests = new bytes32[](pendingCount);
        bytes32[] memory mediumRequests = new bytes32[](pendingCount);
        bytes32[] memory lowRequests = new bytes32[](pendingCount);

        uint256 criticalCount = 0;
        uint256 highCount = 0;
        uint256 mediumCount = 0;
        uint256 lowCount = 0;
        for (uint256 i = 0; i < pendingCount; i++) {
            bytes32 requestId = _pendingRequests.at(i);
            AgentRequest storage request = _requests[requestId];

            if (request.priority == RequestPriority.Critical) {
                criticalRequests[criticalCount++] = requestId;
            } else if (request.priority == RequestPriority.High) {
                highRequests[highCount++] = requestId;
            } else if (request.priority == RequestPriority.Medium) {
                mediumRequests[mediumCount++] = requestId;
            } else {
                lowRequests[lowCount++] = requestId;
            }
        }
        bytes32[] memory result = new bytes32[](actualSize);
        uint256 resultIndex = 0;
        for (
            uint256 i = 0;
            i < criticalCount && resultIndex < actualSize;
            i++
        ) {
            result[resultIndex++] = criticalRequests[i];
        }
        for (uint256 i = 0; i < highCount && resultIndex < actualSize; i++) {
            result[resultIndex++] = highRequests[i];
        }
        for (uint256 i = 0; i < mediumCount && resultIndex < actualSize; i++) {
            result[resultIndex++] = mediumRequests[i];
        }
        for (uint256 i = 0; i < lowCount && resultIndex < actualSize; i++) {
            result[resultIndex++] = lowRequests[i];
        }

        return result;
    }

    function startProcessing(
        bytes32 requestId
    ) external nonReentrant returns (bool) {
        AgentRequest storage request = _requests[requestId];
        if (request.requester == address(0)) revert RequestNotFound(requestId);
        if (request.status != RequestStatus.Pending)
            revert RequestAlreadyProcessed(requestId);
        if (
            msg.sender != request.agentAddress &&
            !_agentRegistry.isAuthorized(msg.sender, PROCESS_REQUEST_PERMISSION)
        ) {
            revert Unauthorized(msg.sender);
        }
        request.status = RequestStatus.Processing;
        _pendingRequests.remove(requestId);
        _processingRequests.add(requestId);

        emit RequestStatusUpdated(requestId, RequestStatus.Processing);

        return true;
    }

    function processRequestBatch(
        bytes32[] calldata requestIds,
        bytes[] calldata results,
        bool[] calldata successes
    ) external nonReentrant returns (uint256) {
        if (
            requestIds.length != results.length ||
            requestIds.length != successes.length
        ) {
            revert InvalidRequest();
        }

        uint256 successCount = 0;

        for (uint256 i = 0; i < requestIds.length; i++) {
            bytes32 requestId = requestIds[i];
            bytes calldata result = results[i];
            bool success = successes[i];
            AgentRequest storage request = _requests[requestId];
            if (request.requester == address(0)) continue;
            if (
                request.status != RequestStatus.Pending &&
                request.status != RequestStatus.Processing
            ) continue;
            if (
                msg.sender != request.agentAddress &&
                !_agentRegistry.isAuthorized(
                    msg.sender,
                    PROCESS_REQUEST_PERMISSION
                )
            ) {
                continue;
            }
            if (success) {
                request.status = RequestStatus.Completed;
                request.result = result;
                _completedRequests.add(requestId);
                successCount++;
            } else {
                request.status = RequestStatus.Failed;
                request.errorMessage = "Processing failed";
                _failedRequests.add(requestId);
            }
            _pendingRequests.remove(requestId);
            _processingRequests.remove(requestId);

            emit RequestStatusUpdated(requestId, request.status);
            emit RequestProcessed(requestId, success);
        }

        return successCount;
    }

    function getRequestStatusCounts()
        external
        view
        returns (
            uint256 pendingCount,
            uint256 processingCount,
            uint256 completedCount,
            uint256 failedCount,
            uint256 cancelledCount
        )
    {
        pendingCount = _pendingRequests.length();
        processingCount = _processingRequests.length();
        completedCount = _completedRequests.length();
        failedCount = _failedRequests.length();
        cancelledCount = _cancelledRequests.length();

        return (
            pendingCount,
            processingCount,
            completedCount,
            failedCount,
            cancelledCount
        );
    }

    function getAllRequesters() external view returns (address[] memory) {
        uint256 length = _requesters.length();
        address[] memory result = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            result[i] = _requesters.at(i);
        }

        return result;
    }

    function setRequestLimit(
        address agentAddress,
        uint256 limit
    ) external onlyOwner {
        agentAddress.validateNotZeroAddress("agentAddress");
        _requestLimits[agentAddress] = limit;
        emit RequestLimitUpdated(agentAddress, limit);
    }

    function setGlobalRequestLimit(uint256 limit) external onlyOwner {
        limit.validateNotZero("limit");
        _globalRequestLimit = limit;
        emit GlobalRequestLimitUpdated(limit);
    }

    function setCooldownPeriod(uint256 period) external onlyOwner {
        _cooldownPeriod = period;
        emit CooldownPeriodUpdated(period);
    }

    function updateAgentRegistry(address agentRegistry) external onlyOwner {
        agentRegistry.validateNotZeroAddress("agentRegistry");
        address oldRegistry = address(_agentRegistry);
        _agentRegistry = IAgentRegistry(agentRegistry);
        emit AgentRegistryUpdated(oldRegistry, agentRegistry);
    }

    function getGlobalRequestLimit() external view returns (uint256) {
        return _globalRequestLimit;
    }

    function getCooldownPeriod() external view returns (uint256) {
        return _cooldownPeriod;
    }

    function getRequestLimit(
        address agentAddress
    ) external view returns (uint256) {
        return _requestLimits[agentAddress];
    }

    function _checkRateLimits(address requester) internal view {
        uint256 agentLimit = _requestLimits[requester];
        uint256 requestCount = _requesterRequests[requester].length();

        if (agentLimit > 0 && requestCount >= agentLimit) {
            revert RequestLimitExceeded(requester, agentLimit, requestCount);
        }
        if (
            _globalRequestLimit > 0 &&
            _pendingRequests.length() >= _globalRequestLimit
        ) {
            revert RequestLimitExceeded(
                address(0),
                _globalRequestLimit,
                _pendingRequests.length()
            );
        }
        uint256 lastRequest = _lastRequestTimestamps[requester];
        if (
            lastRequest > 0 && block.timestamp - lastRequest < _cooldownPeriod
        ) {
            uint256 remainingTime = _cooldownPeriod -
                (block.timestamp - lastRequest);
            revert CooldownPeriodNotElapsed(requester, remainingTime);
        }
    }
}
