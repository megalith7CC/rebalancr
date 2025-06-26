// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;



interface IProtocolAdapter {
	

	function deposit(
		address token,
		uint256 amount,
		bytes calldata data
	) external returns (bool success, address receiptToken, uint256 receiptAmount);

	

	function withdraw(
		address receiptToken,
		uint256 amount,
		bytes calldata data
	) external returns (bool success, address token, uint256 tokenAmount);

	

	function getCurrentAPY(address token) external view returns (uint256 apy);

	

	function getTVL(address token) external view returns (uint256 tvl);

	

	function getReceiptToken(address token) external view returns (address receiptToken);

	

	function isTokenSupported(address token) external view returns (bool supported);

	

	function getProtocolInfo() external view returns (string memory name, string memory version);
}
