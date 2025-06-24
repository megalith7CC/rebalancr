// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library InputValidation {
    error ZeroAddress(string paramName);

    error ZeroValue(string paramName);

    error ValueTooHigh(string paramName, uint256 value, uint256 max);

    error ValueTooLow(string paramName, uint256 value, uint256 min);

    error EmptyArray(string paramName);

    error ArrayLengthMismatch(string array1Name, string array2Name);

    error InvalidLength(
        string paramName,
        uint256 length,
        uint256 minLength,
        uint256 maxLength
    );

    error NotContract(address targetAddress);

    function validateNotZeroAddress(
        address addr,
        string memory paramName
    ) internal pure {
        if (addr == address(0)) {
            revert ZeroAddress(paramName);
        }
    }

    function validateNotZero(
        uint256 value,
        string memory paramName
    ) internal pure {
        if (value == 0) {
            revert ZeroValue(paramName);
        }
    }

    function validateGreaterThanZero(
        uint256 value,
        string memory paramName
    ) internal pure {
        if (value == 0) {
            revert ZeroValue(paramName);
        }
    }

    function validateMaximum(
        uint256 value,
        uint256 maximum,
        string memory paramName
    ) internal pure {
        if (value > maximum) {
            revert ValueTooHigh(paramName, value, maximum);
        }
    }

    function validateMinimum(
        uint256 value,
        uint256 minimum,
        string memory paramName
    ) internal pure {
        if (value < minimum) {
            revert ValueTooLow(paramName, value, minimum);
        }
    }

    function validateRange(
        uint256 value,
        uint256 minimum,
        uint256 maximum,
        string memory paramName
    ) internal pure {
        if (value < minimum) {
            revert ValueTooLow(paramName, value, minimum);
        }
        if (value > maximum) {
            revert ValueTooHigh(paramName, value, maximum);
        }
    }

    function validateNotEmptyArray(
        uint256 arrayLength,
        string memory paramName
    ) internal pure {
        if (arrayLength == 0) {
            revert EmptyArray(paramName);
        }
    }

    function validateEqualArrayLengths(
        uint256 array1Length,
        uint256 array2Length,
        string memory array1Name,
        string memory array2Name
    ) internal pure {
        if (array1Length != array2Length) {
            revert ArrayLengthMismatch(array1Name, array2Name);
        }
    }

    function validateIsContract(address target) internal view {
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(target)
        }
        if (codeSize == 0) {
            revert NotContract(target);
        }
    }

    error EmptyBytes32(string paramName);

    function validateNotEmpty(
        bytes32 value,
        string memory paramName
    ) internal pure {
        if (value == bytes32(0)) {
            revert EmptyBytes32(paramName);
        }
    }

    error EmptyBytes(string paramName);

    function validateNotEmpty(
        bytes calldata value,
        string memory paramName
    ) internal pure {
        if (value.length == 0) {
            revert EmptyBytes(paramName);
        }
    }
}
