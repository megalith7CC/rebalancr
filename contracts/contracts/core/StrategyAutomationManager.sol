// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IAutomationRegistry.sol";
import "../interfaces/IStrategyExecutionBridge.sol";
import "../interfaces/IAgentRegistry.sol";
import "../interfaces/IMarketDataAggregator.sol";
import "../interfaces/IPositionManager.sol";
import "../libraries/InputValidation.sol";

contract StrategyAutomationManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using EnumerableSet for EnumerableSet.AddressSet;
    using InputValidation for address;
    using InputValidation for uint256;
    using InputValidation for bytes32;

    IAutomationRegistry public automationRegistry;
    IStrategyExecutionBridge public strategyExecutionBridge;
    IAgentRegistry public agentRegistry;
    IMarketDataAggregator public marketDataAggregator;
    IPositionManager public positionManager;
    IERC20 public linkToken;
    bytes32 public constant AUTOMATION_ADMIN_PERMISSION = keccak256(abi.encodePacked("AUTOMATION_ADMIN"));
    mapping(bytes32 => bytes32) private _strategyToAutomation;
    mapping(uint256 => bytes32) private _positionToAutomation;
    EnumerableSet.Bytes32Set private _managedStrategies;
    EnumerableSet.Bytes32Set private _managedAutomations;
    mapping(bytes32 => StrategyAutomationConfig) private _strategyConfigs;
    mapping(uint256 => PositionAutomationConfig) private _positionConfigs;


    struct StrategyAutomationConfig {
        bytes32 strategyId;
        uint256 threshold;
        uint256 interval;
        uint256 lastExecuted;
        bool isActive;
    }
    struct PositionAutomationConfig {
        uint256 positionId;
        uint256 healthThreshold;
        uint256 rebalanceThreshold;
        uint256 interval;
        uint256 lastChecked;
        bool isActive;
    }
    
    event StrategyAutomationCreated(
        bytes32 indexed strategyId,
        bytes32 indexed automationId,
        uint256 threshold,
        uint256 interval
    );
    event PositionAutomationCreated(
        uint256 indexed positionId,
        bytes32 indexed automationId,
        uint256 healthThreshold,
        uint256 rebalanceThreshold
    );
    event StrategyAutomationUpdated(
        bytes32 indexed strategyId,
        uint256 threshold,
        uint256 interval,
        bool isActive
    );
    event PositionAutomationUpdated(
        uint256 indexed positionId,
        uint256 healthThreshold,
        uint256 rebalanceThreshold,
        bool isActive
    );
    event StrategyAutomationTriggered(
        bytes32 indexed strategyId,
        bytes32 indexed automationId
    );
    event PositionAutomationTriggered(
        uint256 indexed positionId,
        bytes32 indexed automationId
    );
    
    event AutomationExecuted(bytes32 indexed automationId, bool success);
    error UnauthorizedCaller(address caller);
    error InvalidStrategy(bytes32 strategyId);
    error InvalidPosition(uint256 positionId);
    error InvalidThreshold(uint256 threshold);
    error InvalidInterval(uint256 interval);
    error AutomationAlreadyExists(bytes32 resourceId);
    error AutomationNotFound(bytes32 automationId);
    error InsufficientBalance(uint256 required, uint256 available);
    event SystemComponentUpdated(
        string component,
        address oldAddress,
        address newAddress
    );

    constructor(
        address _automationRegistry,
        address _strategyExecutionBridge,
        address _agentRegistry,
        address _marketDataAggregator,
        address _positionManager,
        address _linkToken
    ) Ownable(msg.sender) {
        _automationRegistry.validateNotZeroAddress("automationRegistry");
        _strategyExecutionBridge.validateNotZeroAddress(
            "strategyExecutionBridge"
        );
        _agentRegistry.validateNotZeroAddress("agentRegistry");
        _marketDataAggregator.validateNotZeroAddress("marketDataAggregator");
        _positionManager.validateNotZeroAddress("positionManager");
        _linkToken.validateNotZeroAddress("linkToken");

        automationRegistry = IAutomationRegistry(_automationRegistry);
        strategyExecutionBridge = IStrategyExecutionBridge(
            _strategyExecutionBridge
        );
        agentRegistry = IAgentRegistry(_agentRegistry);
        marketDataAggregator = IMarketDataAggregator(_marketDataAggregator);
        positionManager = IPositionManager(_positionManager);
        linkToken = IERC20(_linkToken);
    }

    function createStrategyTimeAutomation(
        bytes32 strategyId,
        uint256 interval,
        bytes calldata executeData,
        uint256 linkAmount
    ) external nonReentrant returns (bytes32) {
        if (
            !agentRegistry.isAuthorized(msg.sender, AUTOMATION_ADMIN_PERMISSION)
        ) {
            revert UnauthorizedCaller(msg.sender);
        }
        strategyId.validateNotEmpty("strategyId");

        if (interval < 1 hours) {
            revert InvalidInterval(interval);
        }
        if (_strategyToAutomation[strategyId] != bytes32(0)) {
            revert AutomationAlreadyExists(strategyId);
        }
        StrategyAutomationConfig memory config = StrategyAutomationConfig({
            strategyId: strategyId,
            threshold: 0,
            interval: interval,
            lastExecuted: 0,
            isActive: true
        });
        bytes32 automationId = automationRegistry.registerAutomation(
            string(
                abi.encodePacked("StrategyTime-", bytes32ToString(strategyId))
            ),
            IAutomationRegistry.TriggerType.TIME_BASED,
            abi.encode(interval),
            address(strategyExecutionBridge),
            abi.encodeWithSelector(
                IStrategyExecutionBridge.executeStrategy.selector,
                strategyId,
                executeData
            ),
            0,
            interval,
            300000
        );
        if (linkAmount > 0) {
            linkToken.safeTransferFrom(msg.sender, address(this), linkAmount);
            linkToken.approve(address(automationRegistry), linkAmount);
            automationRegistry.fundAutomation(automationId, linkAmount);
            automationRegistry.activateAutomation(automationId);
        }
        _strategyConfigs[strategyId] = config;
        _strategyToAutomation[strategyId] = automationId;
        _managedStrategies.add(strategyId);
        _managedAutomations.add(automationId);

        emit StrategyAutomationCreated(strategyId, automationId, 0, interval);

        return automationId;
    }

    function createStrategyPriceAutomation(
        bytes32 strategyId,
        address tokenAddress,
        uint256 threshold,
        uint256 interval,
        bytes calldata executeData,
        uint256 linkAmount
    ) external nonReentrant returns (bytes32) {
        if (
            !agentRegistry.isAuthorized(msg.sender, AUTOMATION_ADMIN_PERMISSION)
        ) {
            revert UnauthorizedCaller(msg.sender);
        }
        strategyId.validateNotEmpty("strategyId");
        tokenAddress.validateNotZeroAddress("tokenAddress");

        if (threshold < 100) {
            revert InvalidThreshold(threshold);
        }

        if (interval < 5 minutes) {
            revert InvalidInterval(interval);
        }
        if (_strategyToAutomation[strategyId] != bytes32(0)) {
            revert AutomationAlreadyExists(strategyId);
        }
        StrategyAutomationConfig memory config = StrategyAutomationConfig({
            strategyId: strategyId,
            threshold: threshold,
            interval: interval,
            lastExecuted: 0,
            isActive: true
        });
        bytes32 automationId = automationRegistry.registerAutomation(
            string(
                abi.encodePacked("StrategyPrice-", bytes32ToString(strategyId))
            ),
            IAutomationRegistry.TriggerType.PRICE_DEVIATION,
            abi.encode(tokenAddress, threshold),
            address(strategyExecutionBridge),
            abi.encodeWithSelector(
                IStrategyExecutionBridge.executeStrategy.selector,
                strategyId,
                executeData
            ),
            0,
            interval,
            300000
        );
        if (linkAmount > 0) {
            linkToken.safeTransferFrom(msg.sender, address(this), linkAmount);
            linkToken.approve(address(automationRegistry), linkAmount);
            automationRegistry.fundAutomation(automationId, linkAmount);
            automationRegistry.activateAutomation(automationId);
        }
        _strategyConfigs[strategyId] = config;
        _strategyToAutomation[strategyId] = automationId;
        _managedStrategies.add(strategyId);
        _managedAutomations.add(automationId);

        emit StrategyAutomationCreated(
            strategyId,
            automationId,
            threshold,
            interval
        );

        return automationId;
    }

    function createPositionHealthAutomation(
        uint256 positionId,
        uint256 healthThreshold,
        uint256 rebalanceThreshold,
        uint256 interval,
        uint256 linkAmount
    ) external nonReentrant returns (bytes32) {
        if (
            !agentRegistry.isAuthorized(msg.sender, AUTOMATION_ADMIN_PERMISSION)
        ) {
            revert UnauthorizedCaller(msg.sender);
        }
        if (positionId == 0) {
            revert InvalidPosition(positionId);
        }

        if (healthThreshold < 500 || healthThreshold > 9500) {
            revert InvalidThreshold(healthThreshold);
        }

        if (rebalanceThreshold < 100 || rebalanceThreshold > 1000) {
            revert InvalidThreshold(rebalanceThreshold);
        }

        if (interval < 5 minutes) {
            revert InvalidInterval(interval);
        }
        if (_positionToAutomation[positionId] != bytes32(0)) {
            revert AutomationAlreadyExists(bytes32(positionId));
        }
        PositionAutomationConfig memory config = PositionAutomationConfig({
            positionId: positionId,
            healthThreshold: healthThreshold,
            rebalanceThreshold: rebalanceThreshold,
            interval: interval,
            lastChecked: 0,
            isActive: true
        });
        bytes32 automationId = automationRegistry.registerAutomation(
            string(
                abi.encodePacked("PositionHealth-", uint256ToString(positionId))
            ),
            IAutomationRegistry.TriggerType.POSITION_HEALTH,
            abi.encode(positionId, healthThreshold, rebalanceThreshold),
            address(this),
            abi.encodeWithSelector(
                this.checkAndRebalancePosition.selector,
                positionId
            ),
            0,
            interval,
            300000
        );
        if (linkAmount > 0) {
            linkToken.safeTransferFrom(msg.sender, address(this), linkAmount);
            linkToken.approve(address(automationRegistry), linkAmount);
            automationRegistry.fundAutomation(automationId, linkAmount);
            automationRegistry.activateAutomation(automationId);
        }
        _positionConfigs[positionId] = config;
        _positionToAutomation[positionId] = automationId;
        _managedAutomations.add(automationId);

        emit PositionAutomationCreated(
            positionId,
            automationId,
            healthThreshold,
            rebalanceThreshold
        );

        return automationId;
    }

    function checkAndRebalancePosition(
        uint256 positionId
    ) external nonReentrant returns (bool) {
        if (
            msg.sender != address(automationRegistry) &&
            !agentRegistry.isAuthorized(msg.sender, AUTOMATION_ADMIN_PERMISSION)
        ) {
            revert UnauthorizedCaller(msg.sender);
        }
        PositionAutomationConfig storage config = _positionConfigs[positionId];
        if (config.positionId == 0 || !config.isActive) {
            revert InvalidPosition(positionId);
        }
        config.lastChecked = block.timestamp;
        emit PositionAutomationTriggered(
            positionId,
            _positionToAutomation[positionId]
        );
        return true;
    }

    function updateStrategyAutomation(
        bytes32 strategyId,
        uint256 newThreshold,
        uint256 newInterval,
        bool isActive
    ) external nonReentrant returns (bool) {
        if (
            !agentRegistry.isAuthorized(msg.sender, AUTOMATION_ADMIN_PERMISSION)
        ) {
            revert UnauthorizedCaller(msg.sender);
        }
        bytes32 automationId = _strategyToAutomation[strategyId];
        if (automationId == bytes32(0)) {
            revert AutomationNotFound(automationId);
        }
        StrategyAutomationConfig storage config = _strategyConfigs[strategyId];
        if (newThreshold > 0) {
            config.threshold = newThreshold;
        }

        if (newInterval > 0) {
            if (newInterval < 5 minutes) {
                revert InvalidInterval(newInterval);
            }
            config.interval = newInterval;
            automationRegistry.updateAutomation(
                automationId,
                bytes(""),
                bytes(""),
                newInterval,
                0
            );
        }
        if (config.isActive != isActive) {
            config.isActive = isActive;

            if (isActive) {
                automationRegistry.activateAutomation(automationId);
            } else {
                automationRegistry.deactivateAutomation(automationId);
            }
        }

        emit StrategyAutomationUpdated(
            strategyId,
            config.threshold,
            config.interval,
            config.isActive
        );

        return true;
    }

    function updatePositionAutomation(
        uint256 positionId,
        uint256 newHealthThreshold,
        uint256 newRebalanceThreshold,
        uint256 newInterval,
        bool isActive
    ) external nonReentrant returns (bool) {
        if (
            !agentRegistry.isAuthorized(msg.sender, AUTOMATION_ADMIN_PERMISSION)
        ) {
            revert UnauthorizedCaller(msg.sender);
        }
        bytes32 automationId = _positionToAutomation[positionId];
        if (automationId == bytes32(0)) {
            revert AutomationNotFound(automationId);
        }
        PositionAutomationConfig storage config = _positionConfigs[positionId];
        if (newHealthThreshold > 0) {
            if (newHealthThreshold < 500 || newHealthThreshold > 9500) {
                revert InvalidThreshold(newHealthThreshold);
            }
            config.healthThreshold = newHealthThreshold;
        }

        if (newRebalanceThreshold > 0) {
            if (newRebalanceThreshold < 100 || newRebalanceThreshold > 1000) {
                revert InvalidThreshold(newRebalanceThreshold);
            }
            config.rebalanceThreshold = newRebalanceThreshold;
        }

        if (newInterval > 0) {
            if (newInterval < 5 minutes) {
                revert InvalidInterval(newInterval);
            }
            config.interval = newInterval;
            automationRegistry.updateAutomation(
                automationId,
                bytes(""),
                bytes(""),
                newInterval,
                0
            );
        }
        if (config.isActive != isActive) {
            config.isActive = isActive;

            if (isActive) {
                automationRegistry.activateAutomation(automationId);
            } else {
                automationRegistry.deactivateAutomation(automationId);
            }
        }

        emit PositionAutomationUpdated(
            positionId,
            config.healthThreshold,
            config.rebalanceThreshold,
            config.isActive
        );

        return true;
    }

    function cancelStrategyAutomation(
        bytes32 strategyId
    ) external nonReentrant returns (bool) {
        if (
            !agentRegistry.isAuthorized(msg.sender, AUTOMATION_ADMIN_PERMISSION)
        ) {
            revert UnauthorizedCaller(msg.sender);
        }
        bytes32 automationId = _strategyToAutomation[strategyId];
        if (automationId == bytes32(0)) {
            revert AutomationNotFound(automationId);
        }
        automationRegistry.cancelAutomation(automationId);
        delete _strategyConfigs[strategyId];
        delete _strategyToAutomation[strategyId];
        _managedStrategies.remove(strategyId);
        _managedAutomations.remove(automationId);

        return true;
    }

    function cancelPositionAutomation(
        uint256 positionId
    ) external nonReentrant returns (bool) {
        if (
            !agentRegistry.isAuthorized(msg.sender, AUTOMATION_ADMIN_PERMISSION)
        ) {
            revert UnauthorizedCaller(msg.sender);
        }
        bytes32 automationId = _positionToAutomation[positionId];
        if (automationId == bytes32(0)) {
            revert AutomationNotFound(automationId);
        }
        automationRegistry.cancelAutomation(automationId);
        delete _positionConfigs[positionId];
        delete _positionToAutomation[positionId];
        _managedAutomations.remove(automationId);

        return true;
    }

    function addFunding(
        bytes32 automationId,
        uint256 amount
    ) external nonReentrant returns (bool) {
        if (!_managedAutomations.contains(automationId)) {
            revert AutomationNotFound(automationId);
        }
        linkToken.safeTransferFrom(msg.sender, address(this), amount);
        linkToken.approve(address(automationRegistry), amount);
        return automationRegistry.fundAutomation(automationId, amount);
    }

    function getStrategyAutomationId(
        bytes32 strategyId
    ) external view returns (bytes32) {
        bytes32 automationId = _strategyToAutomation[strategyId];
        if (automationId == bytes32(0)) {
            revert AutomationNotFound(automationId);
        }
        return automationId;
    }

    function getPositionAutomationId(
        uint256 positionId
    ) external view returns (bytes32) {
        bytes32 automationId = _positionToAutomation[positionId];
        if (automationId == bytes32(0)) {
            revert AutomationNotFound(automationId);
        }
        return automationId;
    }

    function getStrategyAutomationConfig(
        bytes32 strategyId
    ) external view returns (StrategyAutomationConfig memory) {
        if (_strategyToAutomation[strategyId] == bytes32(0)) {
            revert InvalidStrategy(strategyId);
        }
        return _strategyConfigs[strategyId];
    }

    function getPositionAutomationConfig(
        uint256 positionId
    ) external view returns (PositionAutomationConfig memory) {
        if (_positionToAutomation[positionId] == bytes32(0)) {
            revert InvalidPosition(positionId);
        }
        return _positionConfigs[positionId];
    }

    function getManagedStrategies() external view returns (bytes32[] memory) {
        uint256 length = _managedStrategies.length();
        bytes32[] memory strategyIds = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            strategyIds[i] = _managedStrategies.at(i);
        }

        return strategyIds;
    }

    function getManagedAutomations() external view returns (bytes32[] memory) {
        uint256 length = _managedAutomations.length();
        bytes32[] memory automationIds = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            automationIds[i] = _managedAutomations.at(i);
        }

        return automationIds;
    }

    function updateAutomationRegistry(address newRegistry) external onlyOwner {
        newRegistry.validateNotZeroAddress("newRegistry");
        address oldRegistry = address(automationRegistry);
        automationRegistry = IAutomationRegistry(newRegistry);
        emit SystemComponentUpdated(
            "AutomationRegistry",
            oldRegistry,
            newRegistry
        );
    }

    function updateStrategyExecutionBridge(
        address newBridge
    ) external onlyOwner {
        newBridge.validateNotZeroAddress("newBridge");
        address oldBridge = address(strategyExecutionBridge);
        strategyExecutionBridge = IStrategyExecutionBridge(newBridge);
        emit SystemComponentUpdated(
            "StrategyExecutionBridge",
            oldBridge,
            newBridge
        );
    }

    function updateAgentRegistry(address newRegistry) external onlyOwner {
        newRegistry.validateNotZeroAddress("newRegistry");
        address oldRegistry = address(agentRegistry);
        agentRegistry = IAgentRegistry(newRegistry);
        emit SystemComponentUpdated("AgentRegistry", oldRegistry, newRegistry);
    }

    function updateMarketDataAggregator(
        address newAggregator
    ) external onlyOwner {
        newAggregator.validateNotZeroAddress("newAggregator");
        address oldAggregator = address(marketDataAggregator);
        marketDataAggregator = IMarketDataAggregator(newAggregator);
        emit SystemComponentUpdated(
            "MarketDataAggregator",
            oldAggregator,
            newAggregator
        );
    }

    function updatePositionManager(address newManager) external onlyOwner {
        newManager.validateNotZeroAddress("newManager");
        address oldManager = address(positionManager);
        positionManager = IPositionManager(newManager);
        emit SystemComponentUpdated("PositionManager", oldManager, newManager);
    }

    function bytes32ToString(
        bytes32 source
    ) internal pure returns (string memory) {
        bytes memory bytesArray = new bytes(32);
        for (uint256 i; i < 32; i++) {
            bytesArray[i] = source[i];
        }
        return string(bytesArray);
    }

    function uint256ToString(
        uint256 value
    ) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }

        uint256 temp = value;
        uint256 digits;

        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }

        return string(buffer);
    }
}
