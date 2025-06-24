pragma solidity ^0.8.28;

import "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../interfaces/IStrategyRouter.sol";
import "../interfaces/IAgentRegistry.sol";
import "../libraries/InputValidation.sol";

contract ChainlinkFunctionsConsumer is FunctionsClient, Ownable, ReentrancyGuard {
    using FunctionsRequest for FunctionsRequest.Request;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    enum RequestStatus {
        Pending,        Fulfilled,        Failed,        Cancelled    }
    struct AgentRequest {
        address agentAddress;        address requester;        uint256 timestamp;        uint32 gasLimit;        RequestStatus status;        bytes requestData;        bytes response;        bytes errorData;    }
    struct FunctionsConfig {
        uint64 subscriptionId;        bytes32 donId;        uint32 callbackGasLimit;        uint32 requestGasLimit;        uint64 donHostedSecretsVersion;        string javaScriptSource;    }
    IStrategyRouter private _strategyRouter;
    IAgentRegistry private _agentRegistry;
    FunctionsConfig private _config;
    mapping(bytes32 => AgentRequest) private _requests;
    mapping(address => EnumerableSet.Bytes32Set) private _requesterRequests;
    EnumerableSet.Bytes32Set private _activeRequests;
    bytes32 private constant EXECUTE_PERMISSION = keccak256(abi.encodePacked("EXECUTE"));
    uint32 private constant MIN_CALLBACK_GAS_LIMIT = 50000;
    uint32 private constant MAX_CALLBACK_GAS_LIMIT = 2500000;
    uint32 private constant MIN_REQUEST_GAS_LIMIT = 100000;

        error InvalidRequestId(bytes32 requestId);
    error RequestAlreadyFulfilled(bytes32 requestId);
    error UnauthorizedRequester(address requester);
    error InsufficientSubscriptionBalance(uint256 required, uint256 available);
    error InvalidGasLimit(uint32 provided, uint32 minimum, uint32 maximum);
    error AgentResponseValidationFailed(bytes32 requestId, string reason);
    error InvalidStrategyRouter(address router);
    error InvalidAgentRegistry(address registry);
    error RequestNotFound(bytes32 requestId);
    error RequestNotPending(bytes32 requestId);
    error EmptyJavaScriptSource();
    error InvalidDONId(bytes32 donId);
    error InvalidSubscriptionId(uint64 subscriptionId);

        event AgentRequestSubmitted(
        bytes32 indexed requestId,
        address indexed agentAddress,
        address indexed requester,
        uint32 gasLimit
    );
    
    event AgentResponseReceived(
        bytes32 indexed requestId,
        bool indexed success,
        bytes response,
        bytes errorData
    );
    
    event StrategyExecutedFromAgent(
        bytes32 indexed requestId,
        bytes32 indexed strategyId,
        bool indexed success,
        bytes executionData
    );
    
    event RequestCancelled(
        bytes32 indexed requestId,
        address indexed requester
    );
    
    event ConfigurationUpdated(
        string indexed parameter,
        uint256 newValue
    );

    event StrategyRouterUpdated(
        address indexed oldRouter,
        address indexed newRouter
    );

    event AgentRegistryUpdated(
        address indexed oldRegistry,
        address indexed newRegistry
    );

        constructor(
        address router,
        address strategyRouter,
        address agentRegistry,
        uint64 subscriptionId,
        bytes32 donId
    ) FunctionsClient(router) Ownable(msg.sender) {
        InputValidation.validateNotZeroAddress(router, "router");
        InputValidation.validateNotZeroAddress(strategyRouter, "strategyRouter");
        InputValidation.validateNotZeroAddress(agentRegistry, "agentRegistry");
        
        if (subscriptionId == 0) revert InvalidSubscriptionId(subscriptionId);
        if (donId == bytes32(0)) revert InvalidDONId(donId);

        _strategyRouter = IStrategyRouter(strategyRouter);
        _agentRegistry = IAgentRegistry(agentRegistry);
        
        _config = FunctionsConfig({
            subscriptionId: subscriptionId,
            donId: donId,
            callbackGasLimit: 100000,
            requestGasLimit: 300000,
            donHostedSecretsVersion: 0,
            javaScriptSource: ""
        });
    }

        function submitAgentRequest(
        address agentAddress,
        bytes calldata requestData,
        uint32 gasLimit
    ) external nonReentrant returns (bytes32 requestId) {
        InputValidation.validateNotZeroAddress(agentAddress, "agentAddress");
        if (requestData.length == 0) revert AgentResponseValidationFailed(bytes32(0), "Empty request data");
        
        if (gasLimit < MIN_CALLBACK_GAS_LIMIT || gasLimit > MAX_CALLBACK_GAS_LIMIT) {
            revert InvalidGasLimit(gasLimit, MIN_CALLBACK_GAS_LIMIT, MAX_CALLBACK_GAS_LIMIT);
        }
        if (!_agentRegistry.isAuthorized(msg.sender, EXECUTE_PERMISSION)) {
            revert UnauthorizedRequester(msg.sender);
        }
        FunctionsRequest.Request memory req;
        req.codeLocation = FunctionsRequest.Location.Inline;
        req.language = FunctionsRequest.CodeLanguage.JavaScript;
        req.source = _config.javaScriptSource;
        req.args = new string[](2);
        req.args[0] = string(abi.encodePacked(agentAddress));
        req.args[1] = string(requestData);
        
        if (_config.donHostedSecretsVersion > 0) {
            req.secretsLocation = FunctionsRequest.Location.DONHosted;
            req.encryptedSecretsReference = abi.encode(_config.donHostedSecretsVersion);
        }
        bytes memory encodedRequest = req.encodeCBOR();
        requestId = _sendRequest(
            encodedRequest,
            _config.subscriptionId,
            gasLimit,
            _config.donId
        );
        _requests[requestId] = AgentRequest({
            agentAddress: agentAddress,
            requester: msg.sender,
            timestamp: block.timestamp,
            gasLimit: gasLimit,
            status: RequestStatus.Pending,
            requestData: requestData,
            response: "",
            errorData: ""
        });
        _activeRequests.add(requestId);
        _requesterRequests[msg.sender].add(requestId);

        emit AgentRequestSubmitted(requestId, agentAddress, msg.sender, gasLimit);
        return requestId;
    }

        function cancelRequest(bytes32 requestId) external nonReentrant {
        InputValidation.validateNotEmpty(requestId, "requestId");
        
        AgentRequest storage request = _requests[requestId];
        if (request.requester == address(0)) revert RequestNotFound(requestId);
        if (request.status != RequestStatus.Pending) revert RequestNotPending(requestId);
        if (request.requester != msg.sender && msg.sender != owner()) {
            revert UnauthorizedRequester(msg.sender);
        }
        request.status = RequestStatus.Cancelled;
        _activeRequests.remove(requestId);

        emit RequestCancelled(requestId, msg.sender);
    }

        function getRequestStatus(bytes32 requestId) external view returns (RequestStatus status) {
        InputValidation.validateNotEmpty(requestId, "requestId");
        
        AgentRequest storage request = _requests[requestId];
        if (request.requester == address(0)) revert RequestNotFound(requestId);
        
        return request.status;
    }

        function getRequestResult(bytes32 requestId) external view returns (bytes memory result) {
        InputValidation.validateNotEmpty(requestId, "requestId");
        
        AgentRequest storage request = _requests[requestId];
        if (request.requester == address(0)) revert RequestNotFound(requestId);
        if (request.status != RequestStatus.Fulfilled) revert RequestAlreadyFulfilled(requestId);
        
        return request.response;
    }

        function executeStrategyFromAgent(
        bytes32 strategyId,
        bytes calldata actionData
    ) external nonReentrant {
        InputValidation.validateNotEmpty(strategyId, "strategyId");
        if (actionData.length == 0) revert AgentResponseValidationFailed(bytes32(0), "Empty action data");
        if (msg.sender != address(this)) {
            revert UnauthorizedRequester(msg.sender);
        }

        try _strategyRouter.executeStrategy(strategyId, actionData) {
        } catch (bytes memory revertData) {
            emit StrategyExecutedFromAgent(bytes32(0), strategyId, false, revertData);
        }
    }

        function batchExecuteFromAgent(
        bytes32[] calldata strategyIds,
        bytes[] calldata actionData
    ) external nonReentrant {
        if (strategyIds.length == 0 || strategyIds.length != actionData.length) {
            revert AgentResponseValidationFailed(bytes32(0), "Invalid batch parameters");
        }
        if (msg.sender != address(this)) {
            revert UnauthorizedRequester(msg.sender);
        }

        for (uint256 i = 0; i < strategyIds.length; i++) {
            InputValidation.validateNotEmpty(strategyIds[i], "strategyId");
            if (actionData[i].length == 0) revert AgentResponseValidationFailed(bytes32(0), "Empty action data");

            try _strategyRouter.executeStrategy(strategyIds[i], actionData[i]) {
                emit StrategyExecutedFromAgent(bytes32(0), strategyIds[i], true, "");
            } catch (bytes memory revertData) {
                emit StrategyExecutedFromAgent(bytes32(0), strategyIds[i], false, revertData);
            }
        }
    }

        function getActiveRequestsCount() external view returns (uint256 count) {
        return _activeRequests.length();
    }

        function getRequestsByRequester(address requester) external view returns (bytes32[] memory requestIds) {
        InputValidation.validateNotZeroAddress(requester, "requester");
        
        EnumerableSet.Bytes32Set storage requests = _requesterRequests[requester];
        uint256 length = requests.length();
        requestIds = new bytes32[](length);
        
        for (uint256 i = 0; i < length; i++) {
            requestIds[i] = requests.at(i);
        }
        
        return requestIds;
    }

        function getSubscriptionInfo() external view returns (uint64 subscriptionId, bytes32 donId) {
        return (_config.subscriptionId, _config.donId);
    }

        function getGasConfiguration() external view returns (uint32 callbackGasLimit, uint32 requestGasLimit) {
        return (_config.callbackGasLimit, _config.requestGasLimit);
    }

        function updateSubscriptionId(uint64 newSubscriptionId) external onlyOwner {
        if (newSubscriptionId == 0) revert InvalidSubscriptionId(newSubscriptionId);
        
        uint64 oldSubscriptionId = _config.subscriptionId;
        _config.subscriptionId = newSubscriptionId;
        
        emit ConfigurationUpdated("subscriptionId", newSubscriptionId);
    }

        function updateGasLimits(uint32 newCallbackGasLimit, uint32 newRequestGasLimit) external onlyOwner {
        if (newCallbackGasLimit < MIN_CALLBACK_GAS_LIMIT || newCallbackGasLimit > MAX_CALLBACK_GAS_LIMIT) {
            revert InvalidGasLimit(newCallbackGasLimit, MIN_CALLBACK_GAS_LIMIT, MAX_CALLBACK_GAS_LIMIT);
        }
        if (newRequestGasLimit < MIN_REQUEST_GAS_LIMIT) {
            revert InvalidGasLimit(newRequestGasLimit, MIN_REQUEST_GAS_LIMIT, type(uint32).max);
        }

        _config.callbackGasLimit = newCallbackGasLimit;
        _config.requestGasLimit = newRequestGasLimit;

        emit ConfigurationUpdated("callbackGasLimit", newCallbackGasLimit);
        emit ConfigurationUpdated("requestGasLimit", newRequestGasLimit);
    }

        function setDONHostedSecretsVersion(uint64 version) external onlyOwner {
        _config.donHostedSecretsVersion = version;
        emit ConfigurationUpdated("donHostedSecretsVersion", version);
    }

        function updateJavaScriptSource(string memory newSource) external onlyOwner {
        bytes memory sourceBytes = bytes(newSource);
        if (sourceBytes.length == 0) revert EmptyJavaScriptSource();

        _config.javaScriptSource = newSource;
        emit ConfigurationUpdated("javaScriptSource", sourceBytes.length);
    }

        function updateStrategyRouter(address newRouter) external onlyOwner {
        InputValidation.validateNotZeroAddress(newRouter, "newRouter");
        
        address oldRouter = address(_strategyRouter);
        _strategyRouter = IStrategyRouter(newRouter);
        
        emit StrategyRouterUpdated(oldRouter, newRouter);
    }

        function updateAgentRegistry(address newRegistry) external onlyOwner {
        InputValidation.validateNotZeroAddress(newRegistry, "newRegistry");
        
        address oldRegistry = address(_agentRegistry);
        _agentRegistry = IAgentRegistry(newRegistry);
        
        emit AgentRegistryUpdated(oldRegistry, newRegistry);
    }

        function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        AgentRequest storage request = _requests[requestId];
        if (request.requester == address(0)) {
            emit AgentResponseReceived(requestId, false, "", "Request not found");
            return;
        }
        
        if (request.status != RequestStatus.Pending) {
            emit AgentResponseReceived(requestId, false, "", "Request not pending");
            return;
        }
        _activeRequests.remove(requestId);
        if (err.length > 0) {
            request.status = RequestStatus.Failed;
            request.errorData = err;
            
            emit AgentResponseReceived(requestId, false, "", err);
        } else {
            request.status = RequestStatus.Fulfilled;
            request.response = response;
            _handleResponse(requestId, response);
            
            emit AgentResponseReceived(requestId, true, response, "");
        }
    }

        function _handleResponse(bytes32 requestId, bytes memory response) internal {
        if (response.length == 0) {
            emit AgentResponseReceived(requestId, false, "", "Empty response");
            return;
        }

        try this._decodeAndExecuteResponse(requestId, response) {
        } catch (bytes memory revertData) {
            emit AgentResponseReceived(requestId, false, response, revertData);
        }
    }

        function _decodeAndExecuteResponse(bytes32 requestId, bytes memory response) external {
        if (msg.sender != address(this)) {
            revert UnauthorizedRequester(msg.sender);
        }
        (bool success, bytes memory result) = address(this).call(
            abi.encodeWithSelector(this._executeSingleStrategy.selector, requestId, response)
        );
        
        if (!success) {
            (bool batchSuccess, bytes memory batchResult) = address(this).call(
                abi.encodeWithSelector(this._executeBatchStrategy.selector, requestId, response)
            );
            
            if (!batchSuccess) {
                revert AgentResponseValidationFailed(requestId, "Unable to decode response");
            }
        }
    }

        function _executeSingleStrategy(bytes32 requestId, bytes memory response) external {
        if (msg.sender != address(this)) {
            revert UnauthorizedRequester(msg.sender);
        }

        (bytes32 strategyId, bytes memory actionData) = abi.decode(response, (bytes32, bytes));
        this.executeStrategyFromAgent(strategyId, actionData);
        emit StrategyExecutedFromAgent(requestId, strategyId, true, "");
    }

        function _executeBatchStrategy(bytes32 requestId, bytes memory response) external {
        if (msg.sender != address(this)) {
            revert UnauthorizedRequester(msg.sender);
        }

        (bytes32[] memory strategyIds, bytes[] memory actionData) = 
            abi.decode(response, (bytes32[], bytes[]));
        this.batchExecuteFromAgent(strategyIds, actionData);
    }
}
