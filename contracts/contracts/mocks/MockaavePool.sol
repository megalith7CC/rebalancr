// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockAavePool {
    mapping(address => mapping(address => uint256)) public aTokenBalances;

    mapping(address => address) public tokenToAToken;

    function setAToken(address token, address aToken) external {
        tokenToAToken[token] = aToken;
    }

    function deposit(address asset, uint256 amount, address onBehalfOf, uint16) external {
        require(tokenToAToken[asset] != address(0), "No aToken set for asset");
        require(amount > 0, "Amount must be > 0");

        IERC20(asset).transferFrom(msg.sender, address(this), amount);

        aTokenBalances[onBehalfOf][asset] += amount;
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        require(tokenToAToken[asset] != address(0), "No aToken set for asset");
        uint256 userBalance = aTokenBalances[msg.sender][asset];
        require(userBalance >= amount, "Not enough aToken balance");

        aTokenBalances[msg.sender][asset] -= amount;

        IERC20(asset).transfer(to, amount);

        return amount;
    }

    struct ReserveData {
        uint256 configuration;
        uint128 liquidityIndex;
        uint128 variableBorrowIndex;
        uint128 currentLiquidityRate;
        uint128 currentVariableBorrowRate;
        uint128 currentStableBorrowRate;
        uint40 lastUpdateTimestamp;
        address aTokenAddress;
        address stableDebtTokenAddress;
        address variableDebtTokenAddress;
        address interestRateStrategyAddress;
        uint8 id;
    }

    function getReserveData(address asset) external view returns (ReserveData memory) {
        return ReserveData({
            configuration: 0,
            liquidityIndex: 0,
            variableBorrowIndex: 0,
            currentLiquidityRate: 0,
            currentVariableBorrowRate: 0,
            currentStableBorrowRate: 0,
            lastUpdateTimestamp: uint40(block.timestamp),
            aTokenAddress: tokenToAToken[asset],
            stableDebtTokenAddress: address(0),
            variableDebtTokenAddress: address(0),
            interestRateStrategyAddress: address(0),
            id: 0
        });
    }
}
