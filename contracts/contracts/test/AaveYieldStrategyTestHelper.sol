// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../strategies/AaveYieldStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AaveYieldStrategyTestHelper is AaveYieldStrategy {
    bool private mockDepositSuccess = true;
    bool private mockWithdrawSuccess = true;
    mapping(address => uint256) private mockATokenBalances;

    function setMockSuccessForDeposit(bool success) external {
        mockDepositSuccess = success;
    }

    function setMockSuccessForWithdraw(bool success) external {
        mockWithdrawSuccess = success;
    }

    function setMockATokenBalance(address token, uint256 balance) external {
        mockATokenBalances[token] = balance;
    }

    function _getATokenBalance(
        address token
    ) internal view override returns (uint256) {
        address aTokenAddr = aTokens[token];
        if (aTokenAddr == address(0)) return 0;

        uint256 mockBalance = mockATokenBalances[token];
        if (mockBalance > 0) {
            return mockBalance;
        } else {
            return IERC20(aTokenAddr).balanceOf(address(this));
        }
    }

    function getATokenBalance(address token) external view returns (uint256) {
        return _getATokenBalance(token);
    }

    function prepareEntryPosition(
        address token,
        uint256 amount
    ) external pure returns (bytes memory) {
        return _prepareEntryPositionData(token, amount);
    }

    function prepareExitPosition(
        uint256 positionId,
        IPositionManager.Position memory position
    ) external pure returns (bytes memory) {
        return _prepareExitPositionData(positionId, position);
    }

    function testOnPositionOpened(
        uint256 /* positionId */,
        address token,
        uint256 amount
    ) external returns (bool) {
        if (amount == 0) revert ZeroAmount();

        address aTokenAddr = aTokens[token];
        if (aTokenAddr == address(0)) revert TokenNotMapped(token);

        if (mockDepositSuccess) {
            totalDeposits[token] += amount;
            _updateTVL();

            emit Deposited(token, amount, msg.sender);
            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Expose _onPositionClosed for testing
     */
    function testOnPositionClosed(
        uint256 /* positionId */,
        IPositionManager.Position memory position
    ) external returns (bool) {
        require(
            position.tokens.length > 0 && position.amounts.length > 0,
            "Invalid position data"
        );

        address token = position.tokens[0];
        uint256 amount = position.amounts[0];

        if (amount == 0) revert ZeroAmount();

        address aTokenAddr = aTokens[token];
        if (aTokenAddr == address(0)) revert TokenNotMapped(token);

        uint256 aTokenBalance = _getATokenBalance(token);
        if (aTokenBalance < amount) {
            revert InsufficientATokenBalance(aTokenAddr, amount, aTokenBalance);
        }

        if (mockWithdrawSuccess) {
            if (amount <= totalDeposits[token]) {
                totalDeposits[token] -= amount;
            } else {
                totalDeposits[token] = 0;
            }
            _updateTVL();

            emit Withdrawn(token, amount, msg.sender);
            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Expose _onPositionRebalanced for testing
     */
    function testOnPositionRebalanced(
        uint256 /* positionId */,
        IPositionManager.Position memory position,
        bytes calldata data
    ) external returns (bool) {
        require(
            position.tokens.length > 0 && position.amounts.length > 0,
            "Invalid position data"
        );

        address oldToken = position.tokens[0];
        uint256 oldAmount = position.amounts[0];

        (address newToken, uint256 newAmount) = abi.decode(
            data,
            (address, uint256)
        );
        address oldATokenAddr = aTokens[oldToken];
        if (oldATokenAddr == address(0)) revert TokenNotMapped(oldToken);
        address newATokenAddr = aTokens[newToken];
        if (newATokenAddr == address(0)) revert TokenNotMapped(newToken);
        uint256 aTokenBalance = _getATokenBalance(oldToken);
        if (aTokenBalance < oldAmount) {
            revert InsufficientATokenBalance(
                oldATokenAddr,
                oldAmount,
                aTokenBalance
            );
        }
        if (!mockWithdrawSuccess) {
            return false;
        }
        if (mockDepositSuccess) {
            if (oldAmount <= totalDeposits[oldToken]) {
                totalDeposits[oldToken] -= oldAmount;
            } else {
                totalDeposits[oldToken] = 0;
            }

            totalDeposits[newToken] += newAmount;
            _updateTVL();

            emit Withdrawn(oldToken, oldAmount, msg.sender);
            emit Deposited(newToken, newAmount, msg.sender);

            return true;
        } else {
            totalDeposits[oldToken] += oldAmount;
            _updateTVL();
            return false;
        }
    }

    /**
     * @dev Expose _executeStrategy for testing
     */
    function testExecuteStrategy(bytes calldata data) external returns (bool) {
        (address token, uint256 amount, bool isDeposit) = abi.decode(
            data,
            (address, uint256, bool)
        );

        if (isDeposit) {
            return _deposit(token, amount);
        } else {
            return _withdraw(token, amount);
        }
    }

    function testValidateParams(
        bytes calldata data
    ) external view returns (bool) {
        return _validateParams(data);
    }

    function _updateTVL() internal override {
        uint256 totalValue = 0;
        StrategyInfo memory info = strategyInfo;

        for (uint256 i = 0; i < info.supportedTokens.length; i++) {
            address token = info.supportedTokens[i];
            if (aTokens[token] == address(0)) continue;
            uint256 mockBalance = mockATokenBalances[token];
            if (mockBalance == 0) {
                mockBalance = totalDeposits[token];
            }
            try priceOracle.getLatestPrice(token) returns (uint256 price) {
                uint8 decimals = tokenDecimals[token];
                if (decimals < 18) {
                    mockBalance = mockBalance * (10 ** (18 - decimals));
                }
                totalValue += (mockBalance * price) / 1e18;
            } catch {
                totalValue += mockBalance;
            }
        }

        tvl = totalValue;
        currentApy = 500;
        riskScore = 25;
        lastUpdateTimestamp = block.timestamp;

        emit PerformanceUpdated(
            tvl,
            currentApy,
            riskScore,
            lastUpdateTimestamp
        );
    }

    function updateTVLAndAPY() external {
        _updateTVL();
    }

    function mockDirectDeposit(address token, uint256 amount) external {
        address aTokenAddr = aTokens[token];
        if (aTokenAddr == address(0)) revert TokenNotMapped(token);
        totalDeposits[token] += amount;
        mockATokenBalances[token] += amount;

        _updateTVL();
        emit Deposited(token, amount, msg.sender);
    }

    function _deposit(
        address token,
        uint256 amount
    ) internal override returns (bool) {
        if (amount == 0) revert ZeroAmount();

        address aTokenAddr = aTokens[token];
        if (aTokenAddr == address(0)) revert TokenNotMapped(token);
        if (mockDepositSuccess) {
            totalDeposits[token] += amount;
            _updateTVL();

            emit Deposited(token, amount, msg.sender);
            return true;
        } else {
            return false;
        }
    }

    function _withdraw(
        address token,
        uint256 amount
    ) internal override returns (bool) {
        if (amount == 0) revert ZeroAmount();

        address aTokenAddr = aTokens[token];
        if (aTokenAddr == address(0)) revert TokenNotMapped(token);
        uint256 aTokenBalance = _getATokenBalance(token);
        if (aTokenBalance < amount) {
            revert InsufficientATokenBalance(aTokenAddr, amount, aTokenBalance);
        }
        if (mockWithdrawSuccess) {
            if (amount <= totalDeposits[token]) {
                totalDeposits[token] -= amount;
            } else {
                totalDeposits[token] = 0;
            }
            _updateTVL();

            emit Withdrawn(token, amount, msg.sender);

            return true;
        } else {
            return false;
        }
    }
}
