// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../interfaces/IPositionManager.sol";
import "../interfaces/IStrategyAgent.sol";
import "../libraries/InputValidation.sol";

contract PositionManager is IPositionManager, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using InputValidation for address;
    using InputValidation for uint256;
    using InputValidation for bytes32;
    
    uint256 private _nextPositionId = 1;
    uint256 private _totalValueLocked;
    mapping(uint256 => Position) private _positions;
    mapping(address => EnumerableSet.UintSet) private _ownerPositions;
    mapping(bytes32 => EnumerableSet.UintSet) private _strategyPositions;
    EnumerableSet.AddressSet private _registeredStrategies;
    EnumerableSet.Bytes32Set private _registeredStrategyIds;

    error PositionNotFound(uint256 positionId);
    error StrategyNotRegistered(bytes32 strategyId);
    error Unauthorized(address caller);
    error InvalidPosition(uint256 positionId);
    error InvalidToken(address token);
    error InvalidAmount(uint256 amount);
    error StrategyAlreadyRegistered(bytes32 strategyId);

    constructor() Ownable(msg.sender) {}

    function registerStrategy(address strategyAgent) external onlyOwner {
        strategyAgent.validateNotZeroAddress("strategyAgent");

        IStrategyAgent strategy = IStrategyAgent(strategyAgent);
        IStrategyAgent.StrategyInfo memory info = strategy.getStrategyInfo();

        bytes32 strategyId = info.id;
        strategyId.validateNotEmpty("strategyId");

        if (_registeredStrategyIds.contains(strategyId)) {
            revert StrategyAlreadyRegistered(strategyId);
        }

        _registeredStrategies.add(strategyAgent);
        _registeredStrategyIds.add(strategyId);
    }

    function deregisterStrategy(bytes32 strategyId) external onlyOwner {
        strategyId.validateNotEmpty("strategyId");

        if (!_registeredStrategyIds.contains(strategyId)) {
            revert StrategyNotRegistered(strategyId);
        }
        address strategyAddress;
        for (uint256 i = 0; i < _registeredStrategies.length(); i++) {
            address addr = _registeredStrategies.at(i);
            IStrategyAgent strategy = IStrategyAgent(addr);
            if (strategy.getStrategyInfo().id == strategyId) {
                strategyAddress = addr;
                break;
            }
        }

        _registeredStrategies.remove(strategyAddress);
        _registeredStrategyIds.remove(strategyId);
    }

    function isStrategyRegistered(
        bytes32 strategyId
    ) external view returns (bool) {
        return _registeredStrategyIds.contains(strategyId);
    }

    function getRegisteredStrategies()
        external
        view
        returns (address[] memory)
    {
        uint256 count = _registeredStrategies.length();
        address[] memory strategies = new address[](count);

        for (uint256 i = 0; i < count; i++) {
            strategies[i] = _registeredStrategies.at(i);
        }

        return strategies;
    }

    function openPosition(
        bytes32 strategyId,
        address token,
        uint256 amount,
        bytes calldata data
    ) external override nonReentrant returns (uint256) {
        strategyId.validateNotEmpty("strategyId");
        token.validateNotZeroAddress("token");
        amount.validateGreaterThanZero("amount");
        if (!_registeredStrategyIds.contains(strategyId)) {
            revert StrategyNotRegistered(strategyId);
        }
        uint256 positionId = _nextPositionId++;
        address strategyAddress;
        for (uint256 i = 0; i < _registeredStrategies.length(); i++) {
            address addr = _registeredStrategies.at(i);
            IStrategyAgent strategy = IStrategyAgent(addr);
            if (strategy.getStrategyInfo().id == strategyId) {
                strategyAddress = addr;
                break;
            }
        }
        address[] memory tokens = new address[](1);
        tokens[0] = token;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        Position memory position = Position({
            id: positionId,
            owner: msg.sender,
            strategyId: strategyId,
            tokens: tokens,
            amounts: amounts,
            entryTimestamp: block.timestamp,
            lastUpdateTimestamp: block.timestamp,
            status: PositionStatus.ACTIVE,
            extraData: data
        });
        _positions[positionId] = position;
        _ownerPositions[msg.sender].add(positionId);
        _strategyPositions[strategyId].add(positionId);
        _totalValueLocked += amount;
        emit PositionOpened(positionId, msg.sender, strategyId, token, amount);

        return positionId;
    }

    function closePosition(
        uint256 positionId,
        bytes calldata data
    ) external override nonReentrant returns (bool) {
        if (!_positionExists(positionId)) {
            revert PositionNotFound(positionId);
        }

        Position storage position = _positions[positionId];
        if (
            position.owner != msg.sender &&
            !isStrategyForPosition(positionId, msg.sender)
        ) {
            revert Unauthorized(msg.sender);
        }
        if (position.status != PositionStatus.ACTIVE) {
            revert InvalidPosition(positionId);
        }
        PositionStatus previousStatus = position.status;
        position.status = PositionStatus.CLOSED;
        position.lastUpdateTimestamp = block.timestamp;
        position.extraData = data;
        for (uint256 i = 0; i < position.amounts.length; i++) {
            _totalValueLocked = _totalValueLocked > position.amounts[i]
                ? _totalValueLocked - position.amounts[i]
                : 0;
        }
        emit PositionClosed(positionId, position.owner);
        emit PositionStatusChanged(
            positionId,
            previousStatus,
            PositionStatus.CLOSED
        );

        return true;
    }

    function getPosition(
        uint256 positionId
    ) external view override returns (Position memory) {
        if (!_positionExists(positionId)) {
            revert PositionNotFound(positionId);
        }
        return _positions[positionId];
    }

    function getActivePositions(
        address owner
    ) external view override returns (uint256[] memory) {
        owner.validateNotZeroAddress("owner");

        EnumerableSet.UintSet storage ownerPositionIds = _ownerPositions[owner];
        uint256 totalPositions = ownerPositionIds.length();
        uint256 activeCount = 0;
        for (uint256 i = 0; i < totalPositions; i++) {
            uint256 posId = ownerPositionIds.at(i);
            if (_positions[posId].status == PositionStatus.ACTIVE) {
                activeCount++;
            }
        }
        uint256[] memory activePositions = new uint256[](activeCount);
        uint256 index = 0;

        for (uint256 i = 0; i < totalPositions; i++) {
            uint256 posId = ownerPositionIds.at(i);
            if (_positions[posId].status == PositionStatus.ACTIVE) {
                activePositions[index] = posId;
                index++;
            }
        }

        return activePositions;
    }

    function modifyPosition(
        uint256 positionId,
        uint256 newAmount,
        bytes calldata data
    ) external override nonReentrant returns (bool) {
        if (!_positionExists(positionId)) {
            revert PositionNotFound(positionId);
        }

        Position storage position = _positions[positionId];
        if (
            position.owner != msg.sender &&
            !isStrategyForPosition(positionId, msg.sender)
        ) {
            revert Unauthorized(msg.sender);
        }
        if (position.status != PositionStatus.ACTIVE) {
            revert InvalidPosition(positionId);
        }
        if (newAmount > 0) {
            uint256 oldAmount = position.amounts[0];
            if (newAmount > oldAmount) {
                _totalValueLocked += (newAmount - oldAmount);
            } else {
                _totalValueLocked = _totalValueLocked > (oldAmount - newAmount)
                    ? _totalValueLocked - (oldAmount - newAmount)
                    : 0;
            }
            position.amounts[0] = newAmount;
        }
        position.lastUpdateTimestamp = block.timestamp;
        position.extraData = data;
        emit PositionModified(positionId, position.owner, newAmount);

        return true;
    }

    function getPositionsForStrategy(
        bytes32 strategyId
    ) external view override returns (uint256[] memory) {
        strategyId.validateNotEmpty("strategyId");

        EnumerableSet.UintSet storage strategyPositionIds = _strategyPositions[
            strategyId
        ];
        uint256 count = strategyPositionIds.length();

        uint256[] memory positionIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            positionIds[i] = strategyPositionIds.at(i);
        }

        return positionIds;
    }

    function getTotalValueLocked() external view override returns (uint256) {
        return _totalValueLocked;
    }

    function getPositionCount() external view override returns (uint256) {
        return _nextPositionId - 1;
    }

    function isPositionOwner(
        uint256 positionId,
        address owner
    ) external view override returns (bool) {
        if (!_positionExists(positionId)) {
            return false;
        }
        return _positions[positionId].owner == owner;
    }

    function isStrategyForPosition(
        uint256 positionId,
        address strategyAddress
    ) public view returns (bool) {
        if (!_positionExists(positionId)) {
            return false;
        }

        bytes32 strategyId = _positions[positionId].strategyId;
        for (uint256 i = 0; i < _registeredStrategies.length(); i++) {
            address addr = _registeredStrategies.at(i);
            if (addr == strategyAddress) {
                IStrategyAgent strategy = IStrategyAgent(addr);
                if (strategy.getStrategyInfo().id == strategyId) {
                    return true;
                }
            }
        }

        return false;
    }

    function _positionExists(uint256 positionId) internal view returns (bool) {
        return
            positionId > 0 &&
            positionId < _nextPositionId &&
            _positions[positionId].id == positionId;
    }
}
