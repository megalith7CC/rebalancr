// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPriceOracle {
    function getLatestPrice(
        address token
    ) external view returns (uint256 price);

    function getTokenPrice(
        address token,
        address denomination
    ) external view returns (uint256 price);
}
