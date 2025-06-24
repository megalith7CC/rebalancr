// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMarketDataAggregator {
    function getTokenPrice(address token) external view returns (uint256 price);

    function getTokenPriceWithHeartbeat(
        address token,
        uint256 maxAge
    ) external view returns (uint256 price, bool valid);

    function getVolatility(
        address token,
        uint256 period
    ) external view returns (uint256 volatility);

    function getYieldProtocolApy(
        string calldata protocol,
        address token
    ) external view returns (uint256 supplyApy, uint256 borrowApy);

    function checkPriceDeviation(
        address token,
        uint256 threshold,
        uint256 timeframe
    ) external view returns (bool exceeded, uint256 deviationBps);

    function refreshMarketData(address token) external returns (bool success);
}
