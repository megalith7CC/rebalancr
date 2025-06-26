// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import './IProtocolAdapter.sol';
import '../libraries/InputValidation.sol';



abstract contract BaseProtocolAdapter is IProtocolAdapter, Ownable, ReentrancyGuard {
	using SafeERC20 for IERC20;

	string public protocolName;

	string public adapterVersion;

	mapping(address => bool) public supportedTokens;

	mapping(address => address) public tokenToReceipt;

	event TokenAdded(address indexed token, address indexed receiptToken);

	event TokenRemoved(address indexed token);

	event Deposited(address indexed token, uint256 amount, address indexed receiptToken, uint256 receiptAmount);

	event Withdrawn(address indexed receiptToken, uint256 amount, address indexed token, uint256 tokenAmount);

	error TokenNotSupported(address token);

	error DepositFailed(address token, uint256 amount);

	error WithdrawalFailed(address receiptToken, uint256 amount);

	

	constructor(string memory _protocolName, string memory _adapterVersion) Ownable(msg.sender) {
		require(bytes(_protocolName).length > 0, 'Protocol name cannot be empty');
		require(bytes(_adapterVersion).length > 0, 'Adapter version cannot be empty');

		protocolName = _protocolName;
		adapterVersion = _adapterVersion;
	}

	

	function addSupportedToken(address token, address receiptToken) external onlyOwner {
		InputValidation.validateNotZeroAddress(token, 'token');
		InputValidation.validateNotZeroAddress(receiptToken, 'receiptToken');

		supportedTokens[token] = true;
		tokenToReceipt[token] = receiptToken;

		emit TokenAdded(token, receiptToken);
	}

	

	function removeSupportedToken(address token) external onlyOwner {
		InputValidation.validateNotZeroAddress(token, 'token');

		supportedTokens[token] = false;
		delete tokenToReceipt[token];

		emit TokenRemoved(token);
	}

	

	function deposit(
		address token,
		uint256 amount,
		bytes calldata data
	) external virtual override nonReentrant returns (bool success, address receiptToken, uint256 receiptAmount) {
		InputValidation.validateNotZeroAddress(token, 'token');
		InputValidation.validateNotZero(amount, 'amount');

		if (!supportedTokens[token]) {
			revert TokenNotSupported(token);
		}

		IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

		(success, receiptToken, receiptAmount) = _protocolDeposit(token, amount, data);

		if (!success) {
			revert DepositFailed(token, amount);
		}

		emit Deposited(token, amount, receiptToken, receiptAmount);
	}

	

	function withdraw(
		address receiptToken,
		uint256 amount,
		bytes calldata data
	) external virtual override nonReentrant returns (bool success, address token, uint256 tokenAmount) {
		InputValidation.validateNotZeroAddress(receiptToken, 'receiptToken');
		InputValidation.validateNotZero(amount, 'amount');

		(success, token, tokenAmount) = _protocolWithdraw(receiptToken, amount, data);

		if (!success) {
			revert WithdrawalFailed(receiptToken, amount);
		}

		IERC20(token).safeTransfer(msg.sender, tokenAmount);

		emit Withdrawn(receiptToken, amount, token, tokenAmount);
	}

	

	function getReceiptToken(address token) external view virtual override returns (address receiptToken) {
		return tokenToReceipt[token];
	}

	

	function isTokenSupported(address token) external view override returns (bool supported) {
		return supportedTokens[token];
	}

	

	function getProtocolInfo() external view override returns (string memory name, string memory version) {
		return (protocolName, adapterVersion);
	}

	

	function emergencyWithdraw(address token, uint256 amount, address recipient) external onlyOwner {
		InputValidation.validateNotZeroAddress(token, 'token');
		InputValidation.validateNotZeroAddress(recipient, 'recipient');
		InputValidation.validateNotZero(amount, 'amount');

		IERC20(token).safeTransfer(recipient, amount);
	}


	

	function _protocolDeposit(
		address token,
		uint256 amount,
		bytes calldata data
	) internal virtual returns (bool success, address receiptToken, uint256 receiptAmount);

	

	function _protocolWithdraw(
		address receiptToken,
		uint256 amount,
		bytes calldata data
	) internal virtual returns (bool success, address token, uint256 tokenAmount);

	

	function getCurrentAPY(address token) external view virtual override returns (uint256 apy);

	

	function getTVL(address token) external view virtual override returns (uint256 tvl);
}
