// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPositionManager {
    enum PositionStatus {
        ACTIVE,
        CLOSED,
        LIQUIDATED
    }

    struct Position {
        uint256 id;
        address owner;
        bytes32 strategyId;
        address[] tokens;
        uint256[] amounts;
        uint256 entryTimestamp;
        uint256 lastUpdateTimestamp;
        PositionStatus status;
        bytes extraData;
    }

    function openPosition(
        bytes32 strategyId,
        address token,
        uint256 amount,
        bytes calldata data
    ) external returns (uint256 positionId);

    function closePosition(
        uint256 positionId,
        bytes calldata data
    ) external returns (bool success);

    function getPosition(
        uint256 positionId
    ) external view returns (Position memory position);

    function getActivePositions(
        address owner
    ) external view returns (uint256[] memory positionIds);

    function modifyPosition(
        uint256 positionId,
        uint256 newAmount,
        bytes calldata data
    ) external returns (bool success);

    function getPositionsForStrategy(
        bytes32 strategyId
    ) external view returns (uint256[] memory positionIds);

    function getTotalValueLocked() external view returns (uint256 tvl);

    function getPositionCount() external view returns (uint256 count);

    function isPositionOwner(
        uint256 positionId,
        address owner
    ) external view returns (bool isOwner);

    event PositionOpened(
        uint256 indexed positionId,
        address indexed owner,
        bytes32 indexed strategyId,
        address token,
        uint256 amount
    );

    event PositionClosed(uint256 indexed positionId, address indexed owner);

    event PositionModified(
        uint256 indexed positionId,
        address indexed owner,
        uint256 newAmount
    );

    event PositionStatusChanged(
        uint256 indexed positionId,
        PositionStatus previousStatus,
        PositionStatus newStatus
    );
}
