// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract MockERC20 is ERC20 {
	uint8 private _decimals;

	constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
		_decimals = decimals_;
	}

	function mint(address account, uint256 amount) public {
		_mint(account, amount);
	}

	function decimals() public view override returns (uint8) {
		return _decimals;
	}
}

contract MockContract {
	mapping(bytes4 => bytes) public mockResponses;
	mapping(bytes4 => bool) public mockReturns;
	mapping(bytes4 => string) public mockRevertMessages;

	function mockReturn(bytes4 selector, bytes memory returnData) public {
		mockResponses[selector] = returnData;
		mockReturns[selector] = true;
		mockRevertMessages[selector] = '';
	}

	function mockCallRevert(bytes4 selector, string memory message) public {
		mockRevertMessages[selector] = message;
		mockReturns[selector] = false;
	}

	fallback() external payable {
		bytes4 selector = bytes4(msg.data);

		string memory revertMsg = mockRevertMessages[selector];
		if (bytes(revertMsg).length > 0) {
			revert(revertMsg);
		}

		if (mockReturns[selector]) {
			bytes memory response = mockResponses[selector];
			assembly {
				return(add(response, 0x20), mload(response))
			}
		}

		revert('MockContract: Function not mocked');
	}

	receive() external payable {}
}

contract MockAutomationTarget {
	bool public returnValue;
	uint256 public callCount;
	bytes public lastCallData;
	uint256 public lastExecuted;
	bool public noCallbacks = true;

	function setReturnValue(bool _value) external {
		returnValue = _value;
	}

	function checkUpkeep(bytes calldata checkData) external view returns (bool upkeepNeeded, bytes memory performData) {
		return (returnValue, checkData);
	}

	function performUpkeep(bytes calldata performData) external {
		lastCallData = performData;
		callCount += 1;
		lastExecuted = block.timestamp;
		if (!noCallbacks) {
			revert('Callbacks disabled in MockAutomationTarget');
		}
	}

	fallback() external {
		lastCallData = msg.data;
		callCount += 1;
		lastExecuted = block.timestamp;
	}

	receive() external payable {}

	function reset() external {
		callCount = 0;
		lastCallData = '';
		lastExecuted = 0;
	}

	function getExecutionInfo() external view returns (uint256 execCount, uint256 timestamp, bytes memory data) {
		return (callCount, lastExecuted, lastCallData);
	}
}
