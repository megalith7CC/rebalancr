// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../core/BaseStrategyAgent.sol";
import "../interfaces/IPositionManager.sol";
import "../interfaces/IPriceOracle.sol";
import "../libraries/MathLib.sol";
import "../libraries/InputValidation.sol";
import "../libraries/ProtocolConstants.sol";

contract BalancerLPStrategy is BaseStrategyAgent {
    using SafeERC20 for IERC20;
    using InputValidation for address;
    using InputValidation for uint256;
    using MathLib for uint256;
    address public balancerVault;
    IPriceOracle public priceOracle;
    mapping(address => address) public poolTokens;
    mapping(bytes32 => PoolInfo) public pools;
    mapping(address => uint256) public totalDeposits;
    mapping(address => uint8) public tokenDecimals;
    struct PoolInfo {
        bytes32 poolId;
        address[] tokens;
        address bpt;
        uint256 swapFee;
        bool active;
    }
    event PoolAdded(bytes32 indexed poolId, address indexed bpt);
    event PoolRemoved(bytes32 indexed poolId);
    event PoolStatusChanged(bytes32 indexed poolId, bool active);
    event Deposited(
        bytes32 indexed poolId,
        address indexed token,
        uint256 amount,
        address indexed user
    );
    event Withdrawn(
        bytes32 indexed poolId,
        address indexed token,
        uint256 amount,
        address indexed user
    );
    event BalancerVaultUpdated(address indexed newVault);
    event PriceOracleUpdated(address indexed newPriceOracle);

    error BalancerOperationFailed(string operation);
    error ZeroAmount();
    error InvalidPool(bytes32 poolId);
    error InactivePool(bytes32 poolId);
    error PoolAlreadyExists(bytes32 poolId);
    error InsufficientLiquidity(
        address token,
        uint256 required,
        uint256 available
    );
    error UnsupportedOperation();

    constructor() Ownable(msg.sender) {}

    function initializeBalancerStrategy(
        bytes calldata data
    ) external onlyOwner {
        (
            address balancerVaultAddress,
            address priceOracleAddress,
            bytes32[] memory poolIds,
            address[][] memory poolTokenAddresses,
            address[] memory bptAddresses,
            uint256[] memory swapFees
        ) = abi.decode(
                data,
                (address, address, bytes32[], address[][], address[], uint256[])
            );
        balancerVaultAddress.validateNotZeroAddress("balancerVaultAddress");
        priceOracleAddress.validateNotZeroAddress("priceOracleAddress");

        require(
            poolIds.length == poolTokenAddresses.length &&
                poolIds.length == bptAddresses.length &&
                poolIds.length == swapFees.length,
            "Array lengths mismatch"
        );
        balancerVault = balancerVaultAddress;
        priceOracle = IPriceOracle(priceOracleAddress);
        for (uint256 i = 0; i < poolIds.length; i++) {
            bytes32 poolId = poolIds[i];
            address[] memory tokens = poolTokenAddresses[i];
            address bpt = bptAddresses[i];
            uint256 swapFee = swapFees[i];

            bpt.validateNotZeroAddress("bpt");
            if (pools[poolId].bpt != address(0)) {
                revert PoolAlreadyExists(poolId);
            }
            pools[poolId] = PoolInfo({
                poolId: poolId,
                tokens: tokens,
                bpt: bpt,
                swapFee: swapFee,
                active: true
            });
            for (uint256 j = 0; j < tokens.length; j++) {
                address token = tokens[j];
                token.validateNotZeroAddress("token");
                poolTokens[token] = bpt;
                tokenDecimals[token] = IERC20Metadata(token).decimals();
            }

            emit PoolAdded(poolId, bpt);
        }

        emit BalancerVaultUpdated(balancerVaultAddress);
        emit PriceOracleUpdated(priceOracleAddress);
    }

    function updateBalancerVault(address newVault) external onlyOwner {
        newVault.validateNotZeroAddress("newVault");
        balancerVault = newVault;
        emit BalancerVaultUpdated(newVault);
    }

    function updatePriceOracle(address newPriceOracle) external onlyOwner {
        newPriceOracle.validateNotZeroAddress("newPriceOracle");
        priceOracle = IPriceOracle(newPriceOracle);
        emit PriceOracleUpdated(newPriceOracle);
    }

    function addPool(
        bytes32 poolId,
        address[] calldata tokens,
        address bpt,
        uint256 swapFee
    ) external onlyOwner {
        bpt.validateNotZeroAddress("bpt");
        if (pools[poolId].bpt != address(0)) {
            revert PoolAlreadyExists(poolId);
        }
        pools[poolId] = PoolInfo({
            poolId: poolId,
            tokens: tokens,
            bpt: bpt,
            swapFee: swapFee,
            active: true
        });
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            token.validateNotZeroAddress("token");
            poolTokens[token] = bpt;
            tokenDecimals[token] = IERC20Metadata(token).decimals();
        }

        emit PoolAdded(poolId, bpt);
    }

    function setPoolStatus(bytes32 poolId, bool active) external onlyOwner {
        if (pools[poolId].bpt == address(0)) {
            revert InvalidPool(poolId);
        }

        pools[poolId].active = active;
        emit PoolStatusChanged(poolId, active);
    }

    function getPoolAPY(bytes32 poolId) public view returns (uint256) {
        if (pools[poolId].bpt == address(0)) {
            revert InvalidPool(poolId);
        }
        uint256 baseAPR = pools[poolId].swapFee * 100;
        uint256 incentiveAPR = 500;
        return baseAPR + incentiveAPR;
    }

    function _executeStrategy(
        bytes calldata data
    ) internal override returns (bool) {
        (bytes32 poolId, address token, uint256 amount, bool isDeposit) = abi
            .decode(data, (bytes32, address, uint256, bool));

        if (isDeposit) {
            return _joinPool(poolId, token, amount);
        } else {
            return _exitPool(poolId, token, amount);
        }
    }

    function _validateParams(
        bytes calldata data
    ) internal view override returns (bool) {
        if (data.length < 96) {
            return false;
        }
        if (data.length >= 128) {
            bytes32 poolId;
            address token;
            uint256 amount;
            bool isDeposit;
            assembly {
                poolId := calldataload(add(data.offset, 0))
                token := calldataload(add(data.offset, 32))
                amount := calldataload(add(data.offset, 64))
                isDeposit := calldataload(add(data.offset, 96))
            }
            if (pools[poolId].bpt == address(0)) {
                return false;
            }
            if (!pools[poolId].active) {
                return false;
            }
            bool tokenFound = false;
            for (uint256 i = 0; i < pools[poolId].tokens.length; i++) {
                if (pools[poolId].tokens[i] == token) {
                    tokenFound = true;
                    break;
                }
            }

            if (!tokenFound) {
                return false;
            }
            if (amount == 0) {
                return false;
            }

            return true;
        } else {
            return false;
        }
    }

    function _prepareEntryPositionData(
        address token,
        uint256 amount
    ) internal view override returns (bytes memory) {
        bytes32 poolId;
        bool foundPool = false;

        for (bytes32 pid; ; ) {
            PoolInfo memory pool = pools[pid];
            if (pool.bpt == address(0)) break;

            for (uint256 i = 0; i < pool.tokens.length; i++) {
                if (pool.tokens[i] == token && pool.active) {
                    poolId = pid;
                    foundPool = true;
                    break;
                }
            }

            if (foundPool) break;
        }

        if (!foundPool) revert UnsupportedOperation();

        return abi.encode(poolId, token, amount, true);
    }

    function _prepareExitPositionData(
        uint256 /* positionId */,
        IPositionManager.Position memory position
    ) internal view override returns (bytes memory) {
        address token = position.tokens[0];
        uint256 amount = position.amounts[0];

        bytes32 poolId;
        bool foundPool = false;

        for (bytes32 pid; ; ) {
            PoolInfo memory pool = pools[pid];
            if (pool.bpt == address(0)) break;

            for (uint256 i = 0; i < pool.tokens.length; i++) {
                if (pool.tokens[i] == token) {
                    poolId = pid;
                    foundPool = true;
                    break;
                }
            }

            if (foundPool) break;
        }

        if (!foundPool) revert UnsupportedOperation();

        return abi.encode(poolId, token, amount, false);
    }

    /**
     * @inheritdoc BaseStrategyAgent
     */
    function _onPositionOpened(
        uint256 /* positionId */,
        address token,
        uint256 amount
    ) internal override returns (bool) {
        bytes32 poolId;
        bool foundPool = false;

        for (bytes32 pid; ; ) {
            PoolInfo memory pool = pools[pid];
            if (pool.bpt == address(0)) break;

            for (uint256 i = 0; i < pool.tokens.length; i++) {
                if (pool.tokens[i] == token && pool.active) {
                    poolId = pid;
                    foundPool = true;
                    break;
                }
            }

            if (foundPool) break;
        }

        if (!foundPool) revert UnsupportedOperation();

        return _joinPool(poolId, token, amount);
    }

    /**
     * @inheritdoc BaseStrategyAgent
     */
    function _onPositionClosed(
        uint256 /* positionId */,
        IPositionManager.Position memory position
    ) internal override returns (bool) {
        address token = position.tokens[0];
        uint256 amount = position.amounts[0];
        bytes32 poolId;
        bool foundPool = false;

        for (bytes32 pid; ; ) {
            PoolInfo memory pool = pools[pid];
            if (pool.bpt == address(0)) break;

            for (uint256 i = 0; i < pool.tokens.length; i++) {
                if (pool.tokens[i] == token) {
                    poolId = pid;
                    foundPool = true;
                    break;
                }
            }

            if (foundPool) break;
        }

        if (!foundPool) revert UnsupportedOperation();

        return _exitPool(poolId, token, amount);
    }

    /**
     * @inheritdoc BaseStrategyAgent
     */
    function _onPositionRebalanced(
        uint256 /* positionId */,
        IPositionManager.Position memory position,
        bytes calldata data
    ) internal override returns (bool) {
        address currentToken = position.tokens[0];
        uint256 currentAmount = position.amounts[0];
        (address newToken, uint256 newAmount) = abi.decode(
            data,
            (address, uint256)
        );
        if (currentToken == newToken) {
            if (newAmount > currentAmount) {
                uint256 addAmount = newAmount - currentAmount;
                bytes32 poolId;
                bool foundPool = false;

                for (bytes32 pid; ; ) {
                    PoolInfo memory pool = pools[pid];
                    if (pool.bpt == address(0)) break;

                    for (uint256 i = 0; i < pool.tokens.length; i++) {
                        if (pool.tokens[i] == currentToken && pool.active) {
                            poolId = pid;
                            foundPool = true;
                            break;
                        }
                    }

                    if (foundPool) break;
                }

                if (!foundPool) revert UnsupportedOperation();

                return _joinPool(poolId, currentToken, addAmount);
            } else if (newAmount < currentAmount) {
                uint256 removeAmount = currentAmount - newAmount;
                bytes32 poolId;
                bool foundPool = false;

                for (bytes32 pid; ; ) {
                    PoolInfo memory pool = pools[pid];
                    if (pool.bpt == address(0)) break;

                    for (uint256 i = 0; i < pool.tokens.length; i++) {
                        if (pool.tokens[i] == currentToken) {
                            poolId = pid;
                            foundPool = true;
                            break;
                        }
                    }

                    if (foundPool) break;
                }

                if (!foundPool) revert UnsupportedOperation();

                return _exitPool(poolId, currentToken, removeAmount);
            } else {
                return true;
            }
        } else {
            bytes32 exitPoolId;
            bytes32 joinPoolId;
            bool foundExitPool = false;
            bool foundJoinPool = false;
            for (bytes32 pid; ; ) {
                PoolInfo memory pool = pools[pid];
                if (pool.bpt == address(0)) break;

                for (uint256 i = 0; i < pool.tokens.length; i++) {
                    if (pool.tokens[i] == currentToken) {
                        exitPoolId = pid;
                        foundExitPool = true;
                        break;
                    }
                }

                if (foundExitPool) break;
            }
            for (bytes32 pid; ; ) {
                PoolInfo memory pool = pools[pid];
                if (pool.bpt == address(0)) break;

                for (uint256 i = 0; i < pool.tokens.length; i++) {
                    if (pool.tokens[i] == newToken && pool.active) {
                        joinPoolId = pid;
                        foundJoinPool = true;
                        break;
                    }
                }

                if (foundJoinPool) break;
            }

            if (!foundExitPool || !foundJoinPool) revert UnsupportedOperation();
            bool exitSuccess = _exitPool(
                exitPoolId,
                currentToken,
                currentAmount
            );
            if (!exitSuccess) return false;
            return _joinPool(joinPoolId, newToken, newAmount);
        }
    }

    /**
     * @inheritdoc BaseStrategyAgent
     */
    function _updateTVL() internal override {
        uint256 totalValue = 0;
        for (bytes32 poolId; ; ) {
            PoolInfo memory pool = pools[poolId];
            if (pool.bpt == address(0)) break;
            uint256 bptBalance = IERC20(pool.bpt).balanceOf(address(this));
            if (bptBalance == 0) continue;
            uint256 bptPriceUSD = priceOracle.getLatestPrice(pool.bpt);
            uint256 poolValue = (bptBalance * bptPriceUSD) / 1e18;
            totalValue += poolValue;
        }

        tvl = totalValue;
        uint256 totalAPY = 0;
        uint256 poolCount = 0;

        for (bytes32 poolId; ; ) {
            PoolInfo memory pool = pools[poolId];
            if (pool.bpt == address(0)) break;

            if (pool.active) {
                totalAPY += getPoolAPY(poolId);
                poolCount++;
            }
        }

        if (poolCount > 0) {
            currentApy = totalAPY / poolCount;
        } else {
            currentApy = 0;
        }

        lastUpdateTimestamp = block.timestamp;

        emit PerformanceUpdated(
            tvl,
            currentApy,
            riskScore,
            lastUpdateTimestamp
        );
    }

    function _joinPool(
        bytes32 poolId,
        address token,
        uint256 amount
    ) internal returns (bool) {
        if (amount == 0) revert ZeroAmount();

        PoolInfo memory pool = pools[poolId];
        if (pool.bpt == address(0)) revert InvalidPool(poolId);
        if (!pool.active) revert InactivePool(poolId);
        totalDeposits[token] += amount;
        _updateTVL();

        emit Deposited(poolId, token, amount, msg.sender);
        return true;
    }

    function _exitPool(
        bytes32 poolId,
        address token,
        uint256 amount
    ) internal returns (bool) {
        if (amount == 0) revert ZeroAmount();

        PoolInfo memory pool = pools[poolId];
        if (pool.bpt == address(0)) revert InvalidPool(poolId);

        if (amount > totalDeposits[token]) {
            revert InsufficientLiquidity(token, amount, totalDeposits[token]);
        }
        totalDeposits[token] -= amount;
        _updateTVL();

        emit Withdrawn(poolId, token, amount, msg.sender);
        return true;
    }
}
