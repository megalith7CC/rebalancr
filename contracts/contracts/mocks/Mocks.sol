// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../core/BaseStrategyAgent.sol";
import "../interfaces/IPositionManager.sol";

contract MockToken is ERC20, ERC20Burnable {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimalsValue
    ) ERC20(name, symbol) {
        _decimals = decimalsValue;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public {
        _burn(from, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}

contract MockPositionManager {
    uint256 private _nextPositionId;
    uint256 private _positionOpenCount;
    uint256 private _positionCloseCount;
    uint256 private _positionModifyCount;

    struct Position {
        uint256 id;
        address owner;
        bytes32 strategyId;
        address[] tokens;
        uint256[] amounts;
        uint256 entryTimestamp;
        uint256 lastUpdateTimestamp;
        uint8 status;
        bytes extraData;
    }

    mapping(uint256 => Position) private _positions;

    function setNextPositionId(uint256 id) public {
        _nextPositionId = id;
    }

    function openPosition(
        bytes32 strategyId,
        address token,
        uint256 amount,
        bytes calldata data
    ) external returns (uint256) {
        uint256 positionId = _nextPositionId++;
        _positionOpenCount++;

        address[] memory tokens = new address[](1);
        tokens[0] = token;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        _positions[positionId] = Position({
            id: positionId,
            owner: msg.sender,
            strategyId: strategyId,
            tokens: tokens,
            amounts: amounts,
            entryTimestamp: block.timestamp,
            lastUpdateTimestamp: block.timestamp,
            status: 0,
            extraData: data
        });

        return positionId;
    }

    function closePosition(
        uint256 positionId,
        bytes calldata data
    ) external returns (bool) {
        Position storage position = _positions[positionId];
        require(position.id == positionId, "Position not found");

        position.status = 1;
        position.lastUpdateTimestamp = block.timestamp;
        position.extraData = data;

        _positionCloseCount++;
        return true;
    }

    function modifyPosition(
        uint256 positionId,
        uint256 newAmount,
        bytes calldata data
    ) external returns (bool) {
        Position storage position = _positions[positionId];
        require(position.id == positionId, "Position not found");

        if (newAmount > 0) {
            position.amounts[0] = newAmount;
        }

        position.lastUpdateTimestamp = block.timestamp;
        position.extraData = data;

        _positionModifyCount++;
        return true;
    }

    function getPosition(
        uint256 positionId
    ) external view returns (Position memory) {
        return _positions[positionId];
    }

    function getPositionOpenCount() external view returns (uint256) {
        return _positionOpenCount;
    }

    function getPositionCloseCount() external view returns (uint256) {
        return _positionCloseCount;
    }

    function getPositionModifyCount() external view returns (uint256) {
        return _positionModifyCount;
    }
}

contract ConcreteStrategyAgent is BaseStrategyAgent {
    constructor() Ownable(msg.sender) {}

    function _updateTVL() internal override {}

    function _executeStrategy(
        bytes calldata
    ) internal pure override returns (bool) {
        return true;
    }

    function _validateParams(
        bytes calldata
    ) internal pure override returns (bool) {
        return true;
    }

    function _prepareEntryPositionData(
        address token,
        uint256 amount
    ) internal pure override returns (bytes memory) {
        return abi.encode(token, amount);
    }

    function _prepareExitPositionData(
        uint256 positionId,
        IPositionManager.Position memory position
    ) internal pure override returns (bytes memory) {
        return abi.encode(positionId, position.tokens[0], position.amounts[0]);
    }

    function _onPositionOpened(
        uint256,
        address,
        uint256
    ) internal pure override returns (bool) {
        return true;
    }

    function _onPositionClosed(
        uint256,
        IPositionManager.Position memory
    ) internal pure override returns (bool) {
        return true;
    }

    function _onPositionRebalanced(
        uint256,
        IPositionManager.Position memory,
        bytes calldata
    ) internal pure override returns (bool) {
        return true;
    }

    function updateTVL() external {
        _updateTVL();
    }

    function executeStrategy(bytes calldata data) external pure returns (bool) {
        return _executeStrategy(data);
    }

    function validateParams(bytes calldata data) external pure returns (bool) {
        return _validateParams(data);
    }
}
