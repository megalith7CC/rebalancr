// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAutomationRegistry {
    enum TriggerType {
        TIME_BASED,
        PRICE_DEVIATION,
        POSITION_HEALTH,
        APY_OPPORTUNITY,
        GAS_OPTIMIZATION
    }

    struct AutomationConfig {
        string name;
        TriggerType triggerType;
        bytes triggerConfig;
        address target;
        bytes executeData;
        uint256 startTime;
        uint256 interval;
        bool isActive;
        uint256 lastExecuted;
        uint256 executionCount;
        uint256 gasLimit;
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
    ) external returns (bytes32 automationId);

    function updateAutomation(
        bytes32 automationId,
        bytes calldata triggerConfig,
        bytes calldata executeData,
        uint256 interval,
        uint256 gasLimit
    ) external returns (bool success);

    function activateAutomation(
        bytes32 automationId
    ) external returns (bool success);

    function deactivateAutomation(
        bytes32 automationId
    ) external returns (bool success);

    function cancelAutomation(
        bytes32 automationId
    ) external returns (bool success);

    function fundAutomation(
        bytes32 automationId,
        uint256 amount
    ) external returns (bool success);

    function getAutomationConfig(
        bytes32 automationId
    ) external view returns (AutomationConfig memory config);

    function getAutomationIds()
        external
        view
        returns (bytes32[] memory automationIds);

    function getAutomationIdsByType(
        TriggerType triggerType
    ) external view returns (bytes32[] memory automationIds);

    function getAutomationsForTarget(
        address target
    ) external view returns (bytes32[] memory automationIds);

    function checkAutomation(
        bytes32 automationId
    ) external view returns (bool isDue, bytes memory performData);

    event AutomationRegistered(
        bytes32 indexed automationId,
        address indexed owner,
        address indexed target,
        TriggerType triggerType
    );

    event AutomationUpdated(
        bytes32 indexed automationId,
        bytes triggerConfig,
        bytes executeData,
        uint256 interval
    );

    event AutomationStatusChanged(bytes32 indexed automationId, bool isActive);

    event AutomationCancelled(bytes32 indexed automationId);

    event AutomationFunded(bytes32 indexed automationId, uint256 amount);

    event UpkeepExecuted(
        bytes32 indexed automationId,
        bool success,
        uint256 gasUsed
    );
}
