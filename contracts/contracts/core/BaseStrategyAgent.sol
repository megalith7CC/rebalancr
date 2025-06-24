// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IStrategyAgent.sol";
import "../interfaces/IPositionManager.sol";
import "../libraries/InputValidation.sol";
import "../libraries/ProtocolConstants.sol";

abstract contract BaseStrategyAgent is IStrategyAgent, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using InputValidation for address;
    using InputValidation for uint256;
    StrategyInfo public strategyInfo;
    IPositionManager public positionManager;
    bool private _initialized;
    bool private _active;
    uint256 public tvl;
    uint256 public currentApy;
    uint256 public riskScore;
    uint256 public lastUpdateTimestamp;
    event StrategyInitialized(bytes32 indexed strategyId, string name, bytes32 riskLevel);
    event StrategyActivated(bytes32 indexed strategyId);
    event StrategyDeactivated(bytes32 indexed strategyId);
    event PerformanceUpdated(uint256 tvl, uint256 apy, uint256 riskScore, uint256 timestamp);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    
        error AlreadyInitialized();
    error NotInitialized();
    error InactiveStrategy();
    error InvalidToken(address token);
    error InsufficientAmount(uint256 provided, uint256 required);
    error UnsupportedToken(address token);
    error ExecutionFailed(bytes reason);
    error Unauthorized(address caller);

        modifier onlyInitialized() {
        if (!_initialized) {
            revert NotInitialized();
        }
        _;
    }

        modifier onlyActive() {
        if (!_active) {
            revert InactiveStrategy();
        }
        _;
    }

        modifier supportedToken(address token) {
        if (!isTokenSupported(token)) {
            revert UnsupportedToken(token);
        }
        _;
    }

        function initialize(bytes calldata data) external override onlyOwner {
        if (_initialized) {
            revert AlreadyInitialized();
        }
        (
            string memory name,
            string memory description,
            address[] memory supportedTokens,
            uint256 minInvestment,
            bytes32 riskLevel,
            uint256 performanceFee,
            address positionManagerAddr
        ) = abi.decode(data, (string, string, address[], uint256, bytes32, uint256, address));
        positionManagerAddr.validateNotZeroAddress("positionManagerAddr");
        minInvestment.validateNotZero("minInvestment");
        performanceFee.validateMaximum(ProtocolConstants.MAX_PERFORMANCE_FEE, "performanceFee");
        positionManager = IPositionManager(positionManagerAddr);
        strategyInfo = StrategyInfo({
            id: keccak256(abi.encodePacked(name, block.timestamp)),
            name: name,
            description: description,
            supportedTokens: supportedTokens,
            minInvestment: minInvestment,
            riskLevel: riskLevel,
            performanceFee: performanceFee,
            active: false,
            implementation: address(this)
        });
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            supportedTokens[i].validateNotZeroAddress("supportedToken");
        }

        _initialized = true;
        _active = false;
        tvl = 0;
        currentApy = 0;
        riskScore = 0;
        lastUpdateTimestamp = block.timestamp;

        emit StrategyInitialized(strategyInfo.id, name, riskLevel);
    }

        function execute(bytes calldata data) external virtual override onlyInitialized onlyActive nonReentrant returns (bool) {
        return _executeStrategy(data);
    }

        function validate(bytes calldata data) external view virtual override returns (bool) {
        return _validateParams(data);
    }

        function entryPosition(address token, uint256 amount) 
        external 
        override 
        onlyInitialized 
        onlyActive
        supportedToken(token)
        nonReentrant 
        returns (uint256) 
    {
        if (amount < strategyInfo.minInvestment) {
            revert InsufficientAmount(amount, strategyInfo.minInvestment);
        }
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        bytes memory positionData = _prepareEntryPositionData(token, amount);
        uint256 positionId = positionManager.openPosition(
            strategyInfo.id,
            token,
            amount,
            positionData
        );
        bool success = _onPositionOpened(positionId, token, amount);
        _updateTVL();
        
        emit PositionOpened(positionId, msg.sender, token, amount);
        
        return positionId;
    }

        function exitPosition(uint256 positionId) 
        external 
        override 
        onlyInitialized 
        nonReentrant 
        returns (bool) 
    {
        IPositionManager.Position memory position = positionManager.getPosition(positionId);
        if (position.strategyId != strategyInfo.id) {
            revert Unauthorized(msg.sender);
        }
        bool success = _onPositionClosed(positionId, position);
        bytes memory exitData = _prepareExitPositionData(positionId, position);
        success = positionManager.closePosition(positionId, exitData) && success;
        _updateTVL();
        
        emit PositionClosed(positionId, position.owner, position.amounts[0]);
        
        return success;
    }

        function rebalancePosition(uint256 positionId, bytes calldata data) 
        external 
        override 
        onlyInitialized 
        onlyActive 
        nonReentrant 
        returns (bool) 
    {
        IPositionManager.Position memory position = positionManager.getPosition(positionId);
        if (position.strategyId != strategyInfo.id) {
            revert Unauthorized(msg.sender);
        }
        bool success = _onPositionRebalanced(positionId, position, data);
        _updateTVL();
        
        emit PositionRebalanced(positionId, position.owner);
        
        return success;
    }

        function getAPY() external view override returns (uint256) {
        return currentApy;
    }

        function getTVL() external view override returns (uint256) {
        return tvl;
    }

        function getRiskScore() external view override returns (uint256) {
        return riskScore;
    }

        function getStrategyInfo() external view override returns (StrategyInfo memory) {
        return strategyInfo;
    }

        function activateStrategy() external onlyOwner onlyInitialized {
        _active = true;
        strategyInfo.active = true;
        emit StrategyActivated(strategyInfo.id);
    }

        function deactivateStrategy() external onlyOwner onlyInitialized {
        _active = false;
        strategyInfo.active = false;
        emit StrategyDeactivated(strategyInfo.id);
    }

        function updatePerformanceMetrics(
        uint256 newTVL,
        uint256 newAPY,
        uint256 newRiskScore
    ) external onlyOwner onlyInitialized {
        _updateMetrics(newTVL, newAPY, newRiskScore);
    }

        function isTokenSupported(address token) public view returns (bool) {
        address[] memory supportedTokens = strategyInfo.supportedTokens;
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == token) {
                return true;
            }
        }
        return false;
    }

        function addSupportedToken(address token) external onlyOwner onlyInitialized {
        token.validateNotZeroAddress("token");
        
        if (isTokenSupported(token)) {
            revert InvalidToken(token);
        }
        address[] memory currentTokens = strategyInfo.supportedTokens;
        address[] memory newTokens = new address[](currentTokens.length + 1);
        
        for (uint256 i = 0; i < currentTokens.length; i++) {
            newTokens[i] = currentTokens[i];
        }
        
        newTokens[currentTokens.length] = token;
        strategyInfo.supportedTokens = newTokens;
        
        emit TokenAdded(token);
    }

        function removeSupportedToken(address token) external onlyOwner onlyInitialized {
        token.validateNotZeroAddress("token");
        
        address[] memory currentTokens = strategyInfo.supportedTokens;
        bool found = false;
        uint256 tokenIndex;
        for (uint256 i = 0; i < currentTokens.length; i++) {
            if (currentTokens[i] == token) {
                found = true;
                tokenIndex = i;
                break;
            }
        }
        
        if (!found) {
            revert InvalidToken(token);
        }
        address[] memory newTokens = new address[](currentTokens.length - 1);
        
        for (uint256 i = 0; i < tokenIndex; i++) {
            newTokens[i] = currentTokens[i];
        }
        
        for (uint256 i = tokenIndex + 1; i < currentTokens.length; i++) {
            newTokens[i - 1] = currentTokens[i];
        }
        
        strategyInfo.supportedTokens = newTokens;
        
        emit TokenRemoved(token);
    }

        function updateDescription(string calldata newDescription) external onlyOwner onlyInitialized {
        strategyInfo.description = newDescription;
    }

        function updateMinInvestment(uint256 newMinInvestment) external onlyOwner onlyInitialized {
        newMinInvestment.validateNotZero("newMinInvestment");
        strategyInfo.minInvestment = newMinInvestment;
    }

        function updatePerformanceFee(uint256 newPerformanceFee) external onlyOwner onlyInitialized {
        newPerformanceFee.validateMaximum(ProtocolConstants.MAX_PERFORMANCE_FEE, "newPerformanceFee");
        strategyInfo.performanceFee = newPerformanceFee;
    }

        function updateRiskLevel(bytes32 newRiskLevel) external onlyOwner onlyInitialized {
        strategyInfo.riskLevel = newRiskLevel;
    }

        function emergencyWithdraw(
        address token, 
        uint256 amount, 
        address recipient
    ) external onlyOwner {
        token.validateNotZeroAddress("token");
        recipient.validateNotZeroAddress("recipient");
        amount.validateNotZero("amount");
        
        IERC20(token).safeTransfer(recipient, amount);
    }

    
        function _updateMetrics(
        uint256 newTVL,
        uint256 newAPY,
        uint256 newRiskScore
    ) internal {
        tvl = newTVL;
        currentApy = newAPY;
        riskScore = newRiskScore;
        lastUpdateTimestamp = block.timestamp;
        
        emit PerformanceUpdated(newTVL, newAPY, newRiskScore, block.timestamp);
    }

        function _updateTVL() internal virtual;

        function _executeStrategy(bytes calldata data) internal virtual returns (bool success);

        function _validateParams(bytes calldata data) internal view virtual returns (bool valid);

        function _prepareEntryPositionData(address token, uint256 amount) internal virtual returns (bytes memory positionData);

        function _prepareExitPositionData(uint256 positionId, IPositionManager.Position memory position) internal virtual returns (bytes memory exitData);

        function _onPositionOpened(uint256 positionId, address token, uint256 amount) internal virtual returns (bool success);

        function _onPositionClosed(uint256 positionId, IPositionManager.Position memory position) internal virtual returns (bool success);

        function _onPositionRebalanced(
        uint256 positionId,
        IPositionManager.Position memory position,
        bytes calldata data
    ) internal virtual returns (bool success);
}
