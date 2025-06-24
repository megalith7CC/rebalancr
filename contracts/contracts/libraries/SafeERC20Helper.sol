// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/Address.sol";

library SafeERC20Helper {
    using Address for address;

    error TransferFailed(
        address token,
        address from,
        address to,
        uint256 amount
    );

    error ApproveFailed(address token, address spender, uint256 amount);

    error TransferFromFailed(
        address token,
        address from,
        address to,
        uint256 amount
    );

    error InvalidToken(address token);

    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        if (address(token) == address(0)) {
            revert InvalidToken(address(0));
        }

        if (amount > 0) {
            (bool success, bytes memory returndata) = address(token).call(
                abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
            );
            if (
                !success ||
                (returndata.length > 0 && !abi.decode(returndata, (bool)))
            ) {
                revert TransferFailed(
                    address(token),
                    address(this),
                    to,
                    amount
                );
            }
        }
    }

    function safeApprove(
        IERC20 token,
        address spender,
        uint256 amount
    ) internal {
        if (address(token) == address(0)) {
            revert InvalidToken(address(0));
        }
        (bool success, bytes memory returndata) = address(token).call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, amount)
        );
        if (
            !success ||
            (returndata.length > 0 && !abi.decode(returndata, (bool)))
        ) {
            revert ApproveFailed(address(token), spender, amount);
        }
    }

    function safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 amount
    ) internal {
        if (address(token) == address(0)) {
            revert InvalidToken(address(0));
        }

        if (amount > 0) {
            (bool success, bytes memory returndata) = address(token).call(
                abi.encodeWithSelector(
                    IERC20.transferFrom.selector,
                    from,
                    to,
                    amount
                )
            );
            if (
                !success ||
                (returndata.length > 0 && !abi.decode(returndata, (bool)))
            ) {
                revert TransferFromFailed(address(token), from, to, amount);
            }
        }
    }

    function getDecimals(address token) internal view returns (uint8 decimals) {
        if (token == address(0)) {
            revert InvalidToken(address(0));
        }
        try IERC20Metadata(token).decimals() returns (uint8 dec) {
            return dec;
        } catch {
            return 18;
        }
    }

    function convertDecimals(
        uint256 amount,
        uint8 fromDecimals,
        uint8 toDecimals
    ) internal pure returns (uint256 convertedAmount) {
        if (fromDecimals == toDecimals) {
            return amount;
        } else if (fromDecimals > toDecimals) {
            return amount / (10 ** (fromDecimals - toDecimals));
        } else {
            return amount * (10 ** (toDecimals - fromDecimals));
        }
    }
}
