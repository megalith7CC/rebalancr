// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;



interface IAaveV2LendingPool {
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

	

	function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;

	

	function withdraw(address asset, uint256 amount, address to) external returns (uint256);

	

	function getUserAccountData(
		address user
	)
		external
		view
		returns (
			uint256 totalCollateralETH,
			uint256 totalDebtETH,
			uint256 availableBorrowsETH,
			uint256 currentLiquidationThreshold,
			uint256 ltv,
			uint256 healthFactor
		);

	

	function getReserveData(address asset) external view returns (ReserveData memory);
}
