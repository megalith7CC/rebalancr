// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../interfaces/IAutomationRegistry.sol";
import "../interfaces/IAutomationCompatible.sol";
import "../interfaces/IAgentRegistry.sol";
import "../libraries/InputValidation.sol";

contract AutomationRegistry is
    IAutomationRegistry,
    IAutomationCompatible,
    Ownable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using EnumerableSet for EnumerableSet.AddressSet;
    using InputValidation for address;
    using InputValidation for uint256;
    using InputValidation for bytes32;
    using InputValidation for bytes;

    address public chainlinkRegistry;
    IERC20 public linkToken;
    IAgentRegistry public agentRegistry;
    bytes32 public constant AUTOMATION_ADMIN_PERMISSION =
        keccak256(abi.encodePacked("AUTOMATION_ADMIN"));
    bytes32 public constant AUTOMATION_EXECUTE_PERMISSION =
        keccak256(abi.encodePacked("AUTOMATION_EXECUTE"));
    mapping(bytes32 => AutomationConfig) private _automations;
    EnumerableSet.Bytes32Set private _automationIds;
    mapping(TriggerType => EnumerableSet.Bytes32Set) private _automationsByType;
    mapping(address => EnumerableSet.Bytes32Set) private _automationsByTarget;
    mapping(bytes32 => uint256) private _automationBalances;
    uint256 private _upkeepCounter;
    uint256 public minimumAutomationFunding;
    uint256 public upkeepGasOverhead;
    uint256 public keeperRegistryGasOverhead;
    bool public paused;

    error UnauthorizedCaller(address caller);
    error InvalidTarget(address target);
    error InvalidTriggerConfig();
    error InvalidGasLimit(uint256 provided, uint256 minimum);
    error InvalidInterval(uint256 provided, uint256 minimum);
    error EmptyBytes(string paramName);
    error InsufficientFunding(uint256 provided, uint256 required);
    error AutomationNotFound(bytes32 automationId);
    error AutomationInactive(bytes32 automationId);
    error AutomationAlreadyExists(bytes32 automationId);
    error SystemPaused();
    error ExecutionFailed(bytes32 automationId, bytes reason);
    error CooldownNotElapsed(bytes32 automationId, uint256 remainingTime);
    error TargetNotCompatible(address target);
    error UpkeepNotNeeded(bytes32 automationId);

    constructor(
        address _chainlinkRegistry,
        address _linkToken,
        address _agentRegistry,
        uint256 _minimumAutomationFunding
    ) Ownable(msg.sender) {
        _chainlinkRegistry.validateNotZeroAddress("chainlinkRegistry");
        _linkToken.validateNotZeroAddress("linkToken");
        _agentRegistry.validateNotZeroAddress("agentRegistry");
        _minimumAutomationFunding.validateNotZero("minimumAutomationFunding");

        chainlinkRegistry = _chainlinkRegistry;
        linkToken = IERC20(_linkToken);
        agentRegistry = IAgentRegistry(_agentRegistry);
        minimumAutomationFunding = _minimumAutomationFunding;
        upkeepGasOverhead = 100000;
        keeperRegistryGasOverhead = 80000;
    }

    function registerAutomation(
        string calldata name,
        TriggerType triggerType,
        bytes calldata triggerConfig,
        address target,
        bytes calldata executeData,
        uint256 startTime,
        uint256 interval,
        uint256 gasLimit
    ) external override nonReentrant returns (bytes32 automationId) {
        if (
            !agentRegistry.isAuthorized(msg.sender, AUTOMATION_ADMIN_PERMISSION)
        ) {
            revert UnauthorizedCaller(msg.sender);
        }
        target.validateNotZeroAddress("target");
        if (executeData.length == 0) {
            revert EmptyBytes("executeData");
        }
        if (triggerConfig.length == 0) {
            revert EmptyBytes("triggerConfig");
        }

        if (gasLimit < upkeepGasOverhead + keeperRegistryGasOverhead) {
            revert InvalidGasLimit(
                gasLimit,
                upkeepGasOverhead + keeperRegistryGasOverhead
            );
        }

        if (interval < 1 minutes) {
            revert InvalidInterval(interval, 1 minutes);
        }
        automationId = keccak256(
            abi.encodePacked(
                block.timestamp,
                _upkeepCounter++,
                target,
                msg.sender
            )
        );
        _automations[automationId] = AutomationConfig({
            name: name,
            triggerType: triggerType,
            triggerConfig: triggerConfig,
            target: target,
            executeData: executeData,
            startTime: startTime == 0 ? block.timestamp : startTime,
            interval: interval,
            isActive: false,
            lastExecuted: 0,
            executionCount: 0,
            gasLimit: gasLimit
        });
        _automationIds.add(automationId);
        _automationsByType[triggerType].add(automationId);
        _automationsByTarget[target].add(automationId);

        emit AutomationRegistered(
            automationId,
            msg.sender,
            target,
            triggerType
        );

        return automationId;
    }

    function updateAutomation(
        bytes32 automationId,
        bytes calldata triggerConfig,
        bytes calldata executeData,
        uint256 interval,
        uint256 gasLimit
    ) external override nonReentrant returns (bool) {
        if (
            !agentRegistry.isAuthorized(msg.sender, AUTOMATION_ADMIN_PERMISSION)
        ) {
            revert UnauthorizedCaller(msg.sender);
        }
        if (!_automationIds.contains(automationId)) {
            revert AutomationNotFound(automationId);
        }
        AutomationConfig storage config = _automations[automationId];
        if (triggerConfig.length > 0) {
            config.triggerConfig = triggerConfig;
        }

        if (executeData.length > 0) {
            config.executeData = executeData;
        }

        if (interval > 0) {
            if (interval < 1 minutes) {
                revert InvalidInterval(interval, 1 minutes);
            }
            config.interval = interval;
        }

        if (gasLimit > 0) {
            if (gasLimit < upkeepGasOverhead + keeperRegistryGasOverhead) {
                revert InvalidGasLimit(
                    gasLimit,
                    upkeepGasOverhead + keeperRegistryGasOverhead
                );
            }
            config.gasLimit = gasLimit;
        }

        emit AutomationUpdated(
            automationId,
            config.triggerConfig,
            config.executeData,
            config.interval
        );

        return true;
    }

    function activateAutomation(
        bytes32 automationId
    ) external override nonReentrant returns (bool) {
        if (
            !agentRegistry.isAuthorized(msg.sender, AUTOMATION_ADMIN_PERMISSION)
        ) {
            revert UnauthorizedCaller(msg.sender);
        }
        if (!_automationIds.contains(automationId)) {
            revert AutomationNotFound(automationId);
        }
        AutomationConfig storage config = _automations[automationId];
        if (_automationBalances[automationId] < minimumAutomationFunding) {
            revert InsufficientFunding(
                _automationBalances[automationId],
                minimumAutomationFunding
            );
        }
        config.isActive = true;

        emit AutomationStatusChanged(automationId, true);

        return true;
    }

    function deactivateAutomation(
        bytes32 automationId
    ) external override nonReentrant returns (bool) {
        if (
            !agentRegistry.isAuthorized(msg.sender, AUTOMATION_ADMIN_PERMISSION)
        ) {
            revert UnauthorizedCaller(msg.sender);
        }
        if (!_automationIds.contains(automationId)) {
            revert AutomationNotFound(automationId);
        }
        AutomationConfig storage config = _automations[automationId];
        config.isActive = false;

        emit AutomationStatusChanged(automationId, false);

        return true;
    }

    function cancelAutomation(
        bytes32 automationId
    ) external override nonReentrant returns (bool) {
        if (
            !agentRegistry.isAuthorized(msg.sender, AUTOMATION_ADMIN_PERMISSION)
        ) {
            revert UnauthorizedCaller(msg.sender);
        }
        if (!_automationIds.contains(automationId)) {
            revert AutomationNotFound(automationId);
        }
        AutomationConfig memory config = _automations[automationId];
        _automationIds.remove(automationId);
        _automationsByType[config.triggerType].remove(automationId);
        _automationsByTarget[config.target].remove(automationId);
        delete _automations[automationId];
        uint256 remainingBalance = _automationBalances[automationId];
        if (remainingBalance > 0) {
            delete _automationBalances[automationId];
            linkToken.safeTransfer(msg.sender, remainingBalance);
        }

        emit AutomationCancelled(automationId);

        return true;
    }

    function fundAutomation(
        bytes32 automationId,
        uint256 amount
    ) external override nonReentrant returns (bool) {
        amount.validateNotZero("amount");
        if (!_automationIds.contains(automationId)) {
            revert AutomationNotFound(automationId);
        }
        linkToken.safeTransferFrom(msg.sender, address(this), amount);
        _automationBalances[automationId] += amount;

        emit AutomationFunded(automationId, amount);

        return true;
    }

    function getAutomationConfig(
        bytes32 automationId
    ) external view override returns (AutomationConfig memory) {
        if (!_automationIds.contains(automationId)) {
            revert AutomationNotFound(automationId);
        }

        return _automations[automationId];
    }

    function getAutomationIds()
        external
        view
        override
        returns (bytes32[] memory)
    {
        uint256 length = _automationIds.length();
        bytes32[] memory ids = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            ids[i] = _automationIds.at(i);
        }

        return ids;
    }

    function getAutomationIdsByType(
        TriggerType triggerType
    ) external view override returns (bytes32[] memory) {
        uint256 length = _automationsByType[triggerType].length();
        bytes32[] memory ids = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            ids[i] = _automationsByType[triggerType].at(i);
        }

        return ids;
    }

    function getAutomationsForTarget(
        address target
    ) external view override returns (bytes32[] memory) {
        uint256 length = _automationsByTarget[target].length();
        bytes32[] memory ids = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            ids[i] = _automationsByTarget[target].at(i);
        }

        return ids;
    }

    function checkAutomation(
        bytes32 automationId
    ) external view override returns (bool, bytes memory) {
        return _internalCheckAutomation(automationId);
    }

    function checkUpkeep(
        bytes calldata checkData
    )
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        if (paused) {
            return (false, bytes(""));
        }
        if (checkData.length >= 32) {
            bytes32 automationId = bytes32(checkData);
            return _internalCheckAutomation(automationId);
        }
        uint256 length = _automationIds.length();
        for (uint256 i = 0; i < length; i++) {
            bytes32 automationId = _automationIds.at(i);
            (bool isDue, bytes memory data) = _internalCheckAutomation(
                automationId
            );
            if (isDue) {
                return (true, data);
            }
        }

        return (false, bytes(""));
    }

    function performUpkeep(
        bytes calldata performData
    ) external override nonReentrant {
        if (
            msg.sender != chainlinkRegistry &&
            !agentRegistry.isAuthorized(
                msg.sender,
                AUTOMATION_EXECUTE_PERMISSION
            )
        ) {
            revert UnauthorizedCaller(msg.sender);
        }

        _internalPerformUpkeep(performData);
    }

    function manualTrigger(
        bytes32 automationId
    ) external nonReentrant returns (bool) {
        if (
            !agentRegistry.isAuthorized(msg.sender, AUTOMATION_ADMIN_PERMISSION)
        ) {
            revert UnauthorizedCaller(msg.sender);
        }
        (
            bool upkeepNeeded,
            bytes memory performData
        ) = _internalCheckAutomation(automationId);

        if (!upkeepNeeded) {
            revert UpkeepNotNeeded(automationId);
        }
        _internalPerformUpkeep(performData);

        return true;
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    function updateMinimumFunding(uint256 newMinimum) external onlyOwner {
        newMinimum.validateNotZero("newMinimum");
        minimumAutomationFunding = newMinimum;
    }

    function updateGasOverhead(
        uint256 newUpkeepGasOverhead,
        uint256 newKeeperRegistryGasOverhead
    ) external onlyOwner {
        upkeepGasOverhead = newUpkeepGasOverhead;
        keeperRegistryGasOverhead = newKeeperRegistryGasOverhead;
    }

    function updateChainlinkRegistry(address newRegistry) external onlyOwner {
        newRegistry.validateNotZeroAddress("newRegistry");
        chainlinkRegistry = newRegistry;
    }

    function getAutomationBalance(
        bytes32 automationId
    ) external view returns (uint256) {
        if (!_automationIds.contains(automationId)) {
            revert AutomationNotFound(automationId);
        }

        return _automationBalances[automationId];
    }

    function _internalCheckAutomation(
        bytes32 automationId
    ) internal view returns (bool isDue, bytes memory performData) {
        if (!_automationIds.contains(automationId)) {
            revert AutomationNotFound(automationId);
        }

        AutomationConfig memory config = _automations[automationId];
        if (!config.isActive) {
            return (false, bytes(""));
        }
        if (block.timestamp < config.startTime) {
            return (false, bytes(""));
        }
        if (
            config.lastExecuted > 0 &&
            block.timestamp - config.lastExecuted < config.interval
        ) {
            return (false, bytes(""));
        }
        if (_automationBalances[automationId] < minimumAutomationFunding) {
            return (false, bytes(""));
        }
        if (config.triggerType == TriggerType.TIME_BASED) {
            return (
                true,
                abi.encode(automationId, config.target, config.executeData)
            );
        } else if (config.triggerType == TriggerType.PRICE_DEVIATION) {
            return (
                true,
                abi.encode(automationId, config.target, config.executeData)
            );
        } else if (config.triggerType == TriggerType.POSITION_HEALTH) {
            return (
                true,
                abi.encode(automationId, config.target, config.executeData)
            );
        } else if (config.triggerType == TriggerType.APY_OPPORTUNITY) {
            return (
                true,
                abi.encode(automationId, config.target, config.executeData)
            );
        } else if (config.triggerType == TriggerType.GAS_OPTIMIZATION) {
            return (
                true,
                abi.encode(automationId, config.target, config.executeData)
            );
        }
        return (false, bytes(""));
    }

    function _internalPerformUpkeep(bytes memory performData) internal {
        if (paused) {
            revert SystemPaused();
        }
        (bytes32 automationId, address target, bytes memory executeData) = abi
            .decode(performData, (bytes32, address, bytes));
        if (!_automationIds.contains(automationId)) {
            revert AutomationNotFound(automationId);
        }

        AutomationConfig storage config = _automations[automationId];

        if (!config.isActive) {
            revert AutomationInactive(automationId);
        }
        if (
            config.lastExecuted > 0 &&
            block.timestamp - config.lastExecuted < config.interval
        ) {
            uint256 remainingTime = config.interval -
                (block.timestamp - config.lastExecuted);
            revert CooldownNotElapsed(automationId, remainingTime);
        }
        uint256 gasStart = gasleft();
        (bool success, bytes memory returnData) = target.call{
            gas: config.gasLimit
        }(executeData);
        uint256 gasUsed = gasStart - gasleft();
        config.lastExecuted = block.timestamp;
        config.executionCount += 1;
        uint256 upkeepCost = 1e17;
        if (_automationBalances[automationId] >= upkeepCost) {
            _automationBalances[automationId] -= upkeepCost;
        }
        emit UpkeepExecuted(automationId, success, gasUsed);
        if (!success) {
            bytes memory reason = returnData.length > 0
                ? returnData
                : bytes("Call failed");
            revert ExecutionFailed(automationId, reason);
        }
    }
}
