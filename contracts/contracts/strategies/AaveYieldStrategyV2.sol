// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '../core/BaseStrategyAgent.sol';
import '../adapters/IProtocolAdapter.sol';
import '../interfaces/IPositionManager.sol';
import '../interfaces/IPriceOracle.sol';
import '../libraries/InputValidation.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';



contract AaveYieldStrategyV2 is BaseStrategyAgent {
	using SafeERC20 for IERC20;

	IProtocolAdapter public immutable aaveAdapter;

	IPriceOracle public priceOracle;

	mapping(address => uint256) public totalDeposits;

	event AdapterDeposit(address indexed token, uint256 amount, address indexed receiptToken, uint256 receiptAmount);
	event AdapterWithdraw(address indexed receiptToken, uint256 amount, address indexed token, uint256 tokenAmount);
	event PriceOracleUpdated(address indexed newPriceOracle);

	error AdapterOperationFailed(string operation);
	error ZeroAmount();
	error TokenNotSupported(address token);
	error InsufficientBalance(address token, uint256 required, uint256 available);

	

	constructor(address _aaveAdapter, address _priceOracle) Ownable(msg.sender) {
		InputValidation.validateNotZeroAddress(_aaveAdapter, 'aaveAdapter');
		InputValidation.validateNotZeroAddress(_priceOracle, 'priceOracle');

		aaveAdapter = IProtocolAdapter(_aaveAdapter);
		priceOracle = IPriceOracle(_priceOracle);
	}

	

	function updatePriceOracle(address newPriceOracle) external onlyOwner {
		InputValidation.validateNotZeroAddress(newPriceOracle, 'newPriceOracle');
		priceOracle = IPriceOracle(newPriceOracle);
		emit PriceOracleUpdated(newPriceOracle);
	}

	

	function getTokenAPY(address token) public view returns (uint256 apy) {
		if (!aaveAdapter.isTokenSupported(token)) {
			return 0;
		}
		return aaveAdapter.getCurrentAPY(token);
	}

	

	function getAverageAPY() public view returns (uint256 averageAPY) {
		address[] memory supportedTokens = strategyInfo.supportedTokens;
		uint256 totalAPY = 0;
		uint256 tokenCount = 0;

		for (uint256 i = 0; i < supportedTokens.length; i++) {
			if (aaveAdapter.isTokenSupported(supportedTokens[i])) {
				totalAPY += getTokenAPY(supportedTokens[i]);
				tokenCount++;
			}
		}

		return tokenCount > 0 ? totalAPY / tokenCount : 0;
	}

	

	function _executeStrategy(bytes calldata data) internal override returns (bool) {
		(address token, uint256 amount, bool isDeposit) = abi.decode(data, (address, uint256, bool));

		if (isDeposit) {
			return _depositToAdapter(token, amount);
		} else {
			return _withdrawFromAdapter(token, amount);
		}
	}

	

	function _validateParams(bytes calldata data) internal view override returns (bool) {
		if (data.length < 96) {
			return false;
		}

		(address token, uint256 amount, bool isDeposit) = abi.decode(data, (address, uint256, bool));

		if (!isTokenSupported(token) || !aaveAdapter.isTokenSupported(token)) {
			return false;
		}

		if (amount == 0) {
			return false;
		}

		if (!isDeposit) {
			address receiptToken = aaveAdapter.getReceiptToken(token);
			if (receiptToken == address(0)) return false;

			uint256 balance = IERC20(receiptToken).balanceOf(address(this));
			if (balance < amount) return false;
		}

		return true;
	}

	

	function _prepareEntryPositionData(address token, uint256 amount) internal pure override returns (bytes memory) {
		return abi.encode(token, amount, true);
	}

	

	function _prepareExitPositionData(
		uint256 ,
		IPositionManager.Position memory position
	) internal view override returns (bytes memory) {
		address token = position.tokens[0];
		address receiptToken = aaveAdapter.getReceiptToken(token);
		uint256 receiptBalance = IERC20(receiptToken).balanceOf(address(this));

		return abi.encode(token, receiptBalance, false);
	}

	

	function _onPositionOpened(uint256 , address token, uint256 amount) internal override returns (bool) {
		return _depositToAdapter(token, amount);
	}

	

	function _onPositionClosed(uint256 , IPositionManager.Position memory position) internal override returns (bool) {
		address token = position.tokens[0];
		address receiptToken = aaveAdapter.getReceiptToken(token);
		uint256 receiptBalance = IERC20(receiptToken).balanceOf(address(this));

		return _withdrawFromAdapter(token, receiptBalance);
	}

	

	function _onPositionRebalanced(
		uint256 ,
		IPositionManager.Position memory position,
		bytes calldata data
	) internal override returns (bool) {
		address oldToken = position.tokens[0];
		address oldReceiptToken = aaveAdapter.getReceiptToken(oldToken);
		uint256 oldReceiptBalance = IERC20(oldReceiptToken).balanceOf(address(this));

		bool withdrawSuccess = _withdrawFromAdapter(oldToken, oldReceiptBalance);
		if (!withdrawSuccess) return false;

		(address newToken, uint256 newAmount) = abi.decode(data, (address, uint256));
		return _depositToAdapter(newToken, newAmount);
	}

	

	function _updateTVL() internal override {
		uint256 totalValue = 0;
		address[] memory supportedTokens = strategyInfo.supportedTokens;

		for (uint256 i = 0; i < supportedTokens.length; i++) {
			address token = supportedTokens[i];

			if (!aaveAdapter.isTokenSupported(token)) continue;

			address receiptToken = aaveAdapter.getReceiptToken(token);
			if (receiptToken == address(0)) continue;

			uint256 receiptBalance = IERC20(receiptToken).balanceOf(address(this));
			if (receiptBalance == 0) continue;

			uint256 tokenPriceUSD = priceOracle.getLatestPrice(token);
			uint256 tokenValue = (receiptBalance * tokenPriceUSD) / (10 ** 18); 
			totalValue += tokenValue;
		}

		uint256 newAPY = getAverageAPY();
		_updateMetrics(totalValue, newAPY, riskScore);
	}

	

	function _depositToAdapter(address token, uint256 amount) internal returns (bool success) {
		if (amount == 0) revert ZeroAmount();
		if (!aaveAdapter.isTokenSupported(token)) revert TokenNotSupported(token);

		IERC20(token).approve(address(aaveAdapter), amount);

		try aaveAdapter.deposit(token, amount, '') returns (bool depositSuccess, address receiptToken, uint256 receiptAmount) {
			if (!depositSuccess) {
				revert AdapterOperationFailed('deposit');
			}

			totalDeposits[token] += amount;
			_updateTVL();

			emit AdapterDeposit(token, amount, receiptToken, receiptAmount);
			return true;
		} catch (bytes memory reason) {
			revert AdapterOperationFailed(string(reason));
		}
	}

	

	function _withdrawFromAdapter(address token, uint256 amount) internal returns (bool success) {
		if (amount == 0) revert ZeroAmount();
		if (!aaveAdapter.isTokenSupported(token)) revert TokenNotSupported(token);

		address receiptToken = aaveAdapter.getReceiptToken(token);
		if (receiptToken == address(0)) revert TokenNotSupported(token);

		uint256 receiptBalance = IERC20(receiptToken).balanceOf(address(this));
		if (receiptBalance < amount) {
			revert InsufficientBalance(receiptToken, amount, receiptBalance);
		}

		try aaveAdapter.withdraw(receiptToken, amount, '') returns (
			bool withdrawSuccess,
			address withdrawnToken,
			uint256 withdrawnAmount
		) {
			if (!withdrawSuccess) {
				revert AdapterOperationFailed('withdraw');
			}

			if (withdrawnAmount <= totalDeposits[token]) {
				totalDeposits[token] -= withdrawnAmount;
			} else {
				totalDeposits[token] = 0;
			}

			_updateTVL();

			emit AdapterWithdraw(receiptToken, amount, withdrawnToken, withdrawnAmount);
			return true;
		} catch (bytes memory reason) {
			revert AdapterOperationFailed(string(reason));
		}
	}

	

	function getReceiptTokenBalance(address token) external view returns (uint256 balance) {
		address receiptToken = aaveAdapter.getReceiptToken(token);
		if (receiptToken == address(0)) return 0;
		return IERC20(receiptToken).balanceOf(address(this));
	}

	

	function getTotalDeposits(address token) external view returns (uint256 deposits) {
		return totalDeposits[token];
	}
}
