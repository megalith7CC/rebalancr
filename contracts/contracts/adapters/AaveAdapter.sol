// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '../interfaces/IAaveV2LendingPool.sol';
import '../interfaces/IAaveV2AToken.sol';
import './BaseProtocolAdapter.sol';



contract AaveAdapter is BaseProtocolAdapter {
	IAaveV2LendingPool public immutable aavePool;

	mapping(address => address) public tokenToAToken;
	
	mapping(address => address) public aTokenToToken;

	

	constructor(address _aavePool) BaseProtocolAdapter('Aave V2', '1.0.0') {
		InputValidation.validateNotZeroAddress(_aavePool, 'aavePool');
		aavePool = IAaveV2LendingPool(_aavePool);
	}

	

	function setAaveTokenMapping(address token, address aToken) external onlyOwner {
		InputValidation.validateNotZeroAddress(token, 'token');
		InputValidation.validateNotZeroAddress(aToken, 'aToken');

		tokenToAToken[token] = aToken;
		aTokenToToken[aToken] = token;
		
		_addSupportedTokenInternal(token, aToken);
	}

	

	function _protocolDeposit(
		address token,
		uint256 amount,
		bytes calldata
	) internal override returns (bool success, address receiptToken, uint256 receiptAmount) {
		address aToken = tokenToAToken[token];
		require(aToken != address(0), 'aToken not found');

		IERC20(token).approve(address(aavePool), amount);

		uint256 balanceBefore = IERC20(aToken).balanceOf(address(this));

		aavePool.deposit(token, amount, address(this), 0);

		uint256 balanceAfter = IERC20(aToken).balanceOf(address(this));

		receiptAmount = balanceAfter - balanceBefore;
		receiptToken = aToken;
		success = receiptAmount > 0;
	}

	

	function _protocolWithdraw(
		address receiptToken,
		uint256 amount,
		bytes calldata
	) internal override returns (bool success, address token, uint256 tokenAmount) {
		address underlyingToken = aTokenToToken[receiptToken];
		require(underlyingToken != address(0), 'Underlying token not found');

		uint256 balanceBefore = IERC20(underlyingToken).balanceOf(address(this));

		uint256 withdrawAmount = amount;
		if (amount == type(uint256).max) {
			withdrawAmount = IERC20(receiptToken).balanceOf(address(this));
		}
		
		tokenAmount = aavePool.withdraw(underlyingToken, withdrawAmount, address(this));

		uint256 balanceAfter = IERC20(underlyingToken).balanceOf(address(this));
		uint256 actualReceived = balanceAfter - balanceBefore;

		token = underlyingToken;
		success = actualReceived > 0 && actualReceived == tokenAmount;
	}

	

	function getCurrentAPY(address token) external view override returns (uint256 apy) {
		try aavePool.getReserveData(token) returns (IAaveV2LendingPool.ReserveData memory reserveData) {
			apy = (reserveData.currentLiquidityRate * 10000) / 1e27;
		} catch {
			apy = 0;
		}
	}

	

	function getTVL(address token) external view override returns (uint256 tvl) {
		address aToken = tokenToAToken[token];
		if (aToken != address(0)) {
			tvl = IERC20(aToken).balanceOf(address(this));
		}
	}

	

	function getReceiptToken(address token) external view override returns (address) {
		return tokenToAToken[token];
	}

	

	function getUnderlyingToken(address aToken) external view returns (address underlyingToken) {
		return aTokenToToken[aToken];
	}

	

	function batchSetAaveTokenMappings(
		address[] calldata tokens, 
		address[] calldata aTokens
	) external onlyOwner {
		require(tokens.length == aTokens.length, 'Array length mismatch');
		
		for (uint256 i = 0; i < tokens.length; i++) {
			InputValidation.validateNotZeroAddress(tokens[i], 'token');
			InputValidation.validateNotZeroAddress(aTokens[i], 'aToken');
			
			tokenToAToken[tokens[i]] = aTokens[i];
			aTokenToToken[aTokens[i]] = tokens[i];
			_addSupportedTokenInternal(tokens[i], aTokens[i]);
		}
	}

	

	function _addSupportedTokenInternal(address token, address receiptToken) internal {
		supportedTokens[token] = true;
		tokenToReceipt[token] = receiptToken;
		emit TokenAdded(token, receiptToken);
	}
}
