// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IStrategyAgent.sol";
import "../interfaces/IPositionManager.sol";

contract MockStrategyAgent is IStrategyAgent, Ownable {
    StrategyInfo public strategyInfo;
    uint256 public mockTvl;
    uint256 public mockApy;
    uint256 public mockRiskScore;
    bool private _initialized;

    constructor() Ownable(msg.sender) {}

    function initialize(
        bytes32 id,
        string memory name,
        string memory description,
        address[] memory supportedTokens,
        uint256 minInvestment,
        bytes32 riskLevel,
        uint256 performanceFee
    ) public {
        require(!_initialized, "Already initialized");

        strategyInfo = StrategyInfo({
            id: id,
            name: name,
            description: description,
            supportedTokens: supportedTokens,
            minInvestment: minInvestment,
            riskLevel: riskLevel,
            performanceFee: performanceFee,
            active: true,
            implementation: address(this)
        });

        _initialized = true;
    }

    function initialize(bytes calldata data) external override {
        (
            bytes32 id,
            string memory name,
            string memory description,
            address[] memory supportedTokens,
            uint256 minInvestment,
            bytes32 riskLevel,
            uint256 performanceFee
        ) = abi.decode(
                data,
                (bytes32, string, string, address[], uint256, bytes32, uint256)
            );

        initialize(
            id,
            name,
            description,
            supportedTokens,
            minInvestment,
            riskLevel,
            performanceFee
        );
    }

    bool private _executeSuccess = true;
    bool private _validateResult = true;

    function setPerformanceMetrics(
        uint256 tvl,
        uint256 apy,
        uint256 riskScore
    ) external {
        mockTvl = tvl;
        mockApy = apy;
        mockRiskScore = riskScore;
    }

    function setExecuteSuccess(bool success) external onlyOwner {
        _executeSuccess = success;
    }

    function setValidateResult(bool result) external onlyOwner {
        _validateResult = result;
    }

    function execute(
        bytes calldata /* data */
    ) external override returns (bool) {
        if (!_executeSuccess) {
            revert("MockStrategyAgent: Execution failed");
        }

        emit StrategyExecuted(msg.sender, bytes32("MOCK_OPERATION"), true);
        return true;
    }

    function validate(
        bytes calldata /* data */
    ) external view override returns (bool) {
        return _validateResult;
    }

    function entryPosition(
        address token,
        uint256 amount
    ) external override returns (uint256) {
        emit PositionOpened(1, msg.sender, token, amount);
        return 1;
    }

    function exitPosition(uint256 positionId) external override returns (bool) {
        emit PositionClosed(positionId, msg.sender, 0);
        return true;
    }

    function rebalancePosition(
        uint256 positionId,
        bytes calldata /* data */
    ) external override returns (bool) {
        emit PositionRebalanced(positionId, msg.sender);
        return true;
    }

    function getAPY() external view override returns (uint256) {
        return mockApy;
    }

    function getTVL() external view override returns (uint256) {
        return mockTvl;
    }

    function getRiskScore() external view override returns (uint256) {
        return mockRiskScore;
    }

    function getStrategyInfo()
        external
        view
        override
        returns (StrategyInfo memory)
    {
        return strategyInfo;
    }
}
