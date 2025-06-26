// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import './BaseProtocolAdapter.sol';

interface IBalancerVault {
	struct JoinPoolRequest {
		address[] assets;
		uint256[] maxAmountsIn;
		bytes userData;
		bool fromInternalBalance;
	}

	struct ExitPoolRequest {
		address[] assets;
		uint256[] minAmountsOut;
		bytes userData;
		bool toInternalBalance;
	}

	function joinPool(bytes32 poolId, address sender, address recipient, JoinPoolRequest memory request) external payable;

	function exitPool(bytes32 poolId, address sender, address payable recipient, ExitPoolRequest memory request) external;

	function getPoolTokens(
		bytes32 poolId
	) external view returns (address[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock);
}

interface IBPT {
	function getPoolId() external view returns (bytes32);

	function totalSupply() external view returns (uint256);
}



contract BalancerAdapter is BaseProtocolAdapter {
	IBalancerVault public immutable balancerVault;

	mapping(address => bytes32) public tokenToPoolId;

	mapping(bytes32 => address) public poolIdToBPT;

	uint256 private constant EXACT_TOKENS_IN_FOR_BPT_OUT = 1;

	uint256 private constant EXACT_BPT_IN_FOR_TOKENS_OUT = 1;

	

	constructor(address _balancerVault) BaseProtocolAdapter('Balancer V2', '1.0.0') {
		InputValidation.validateNotZeroAddress(_balancerVault, 'balancerVault');
		balancerVault = IBalancerVault(_balancerVault);
	}

	

	function addBalancerPool(address token, bytes32 poolId, address bptToken) external onlyOwner {
		InputValidation.validateNotZeroAddress(token, 'token');
		InputValidation.validateNotEmpty(poolId, 'poolId');
		InputValidation.validateNotZeroAddress(bptToken, 'bptToken');

		tokenToPoolId[token] = poolId;
		poolIdToBPT[poolId] = bptToken;
	}

	

	function _protocolDeposit(
		address token,
		uint256 amount,
		bytes calldata 
	) internal override returns (bool success, address receiptToken, uint256 receiptAmount) {
		bytes32 poolId = tokenToPoolId[token];
		require(poolId != bytes32(0), 'Pool not found for token');

		address bptToken = poolIdToBPT[poolId];
		require(bptToken != address(0), 'BPT token not found');

		(address[] memory poolTokens, , ) = balancerVault.getPoolTokens(poolId);

		uint256 tokenIndex = type(uint256).max;
		for (uint256 i = 0; i < poolTokens.length; i++) {
			if (poolTokens[i] == token) {
				tokenIndex = i;
				break;
			}
		}
		require(tokenIndex != type(uint256).max, 'Token not found in pool');

		uint256[] memory maxAmountsIn = new uint256[](poolTokens.length);
		maxAmountsIn[tokenIndex] = amount;

		bytes memory userData = abi.encode(EXACT_TOKENS_IN_FOR_BPT_OUT, maxAmountsIn, 0);

		IBalancerVault.JoinPoolRequest memory request = IBalancerVault.JoinPoolRequest({
			assets: poolTokens,
			maxAmountsIn: maxAmountsIn,
			userData: userData,
			fromInternalBalance: false
		});

		IERC20(token).approve(address(balancerVault), amount);

		uint256 bptBalanceBefore = IERC20(bptToken).balanceOf(address(this));

		try balancerVault.joinPool(poolId, address(this), address(this), request) {
			uint256 bptBalanceAfter = IERC20(bptToken).balanceOf(address(this));

			receiptAmount = bptBalanceAfter - bptBalanceBefore;
			receiptToken = bptToken;
			success = receiptAmount > 0;
		} catch {
			success = false;
		}
	}

	

	function _protocolWithdraw(
		address receiptToken,
		uint256 amount,
		bytes calldata 
	) internal override returns (bool success, address token, uint256 tokenAmount) {
		bytes32 poolId = _findPoolIdForBPT(receiptToken);
		require(poolId != bytes32(0), 'Pool not found for BPT');

		(address[] memory poolTokens, , ) = balancerVault.getPoolTokens(poolId);

		uint256[] memory minAmountsOut = new uint256[](poolTokens.length);

		bytes memory userData = abi.encode(EXACT_BPT_IN_FOR_TOKENS_OUT, amount);

		IBalancerVault.ExitPoolRequest memory request = IBalancerVault.ExitPoolRequest({
			assets: poolTokens,
			minAmountsOut: minAmountsOut,
			userData: userData,
			toInternalBalance: false
		});

		uint256[] memory balancesBefore = new uint256[](poolTokens.length);
		for (uint256 i = 0; i < poolTokens.length; i++) {
			balancesBefore[i] = IERC20(poolTokens[i]).balanceOf(address(this));
		}

		try balancerVault.exitPool(poolId, address(this), payable(address(this)), request) {
			uint256 maxIncrease = 0;
			uint256 maxIncreaseIndex = 0;

			for (uint256 i = 0; i < poolTokens.length; i++) {
				uint256 balanceAfter = IERC20(poolTokens[i]).balanceOf(address(this));
				uint256 increase = balanceAfter - balancesBefore[i];
				if (increase > maxIncrease) {
					maxIncrease = increase;
					maxIncreaseIndex = i;
				}
			}

			token = poolTokens[maxIncreaseIndex];
			tokenAmount = maxIncrease;
			success = tokenAmount > 0;
		} catch {
			success = false;
		}
	}

	

	function getCurrentAPY(address ) external pure override returns (uint256 apy) {
		return 0;
	}

	

	function getTVL(address token) external view override returns (uint256 tvl) {
		bytes32 poolId = tokenToPoolId[token];
		if (poolId == bytes32(0)) return 0;

		address bptToken = poolIdToBPT[poolId];
		if (bptToken == address(0)) return 0;

		return IERC20(bptToken).balanceOf(address(this));
	}

	

	function _findPoolIdForBPT(address bptToken) internal view returns (bytes32 poolId) {
		try IBPT(bptToken).getPoolId() returns (bytes32 id) {
			return id;
		} catch {
			return bytes32(0);
		}
	}

	

	function getPoolInfo(bytes32 poolId) external view returns (address[] memory tokens, uint256[] memory balances) {
		(tokens, balances, ) = balancerVault.getPoolTokens(poolId);
	}
}
