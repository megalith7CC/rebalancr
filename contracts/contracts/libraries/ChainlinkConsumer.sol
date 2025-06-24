// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

library ChainlinkConsumer {
    error StalePrice(
        uint80 roundId,
        uint256 timestamp,
        uint256 stalePriceThreshold
    );

    error NegativePrice(int256 price);

    error InvalidPriceFeed(address priceFeed);

    struct PriceData {
        uint80 roundId;
        int256 price;
        uint256 timestamp;
        bool success;
        uint8 decimals;
    }

    function getLatestPrice(
        AggregatorV3Interface priceFeed
    ) internal view returns (uint256 price) {
        if (address(priceFeed) == address(0)) {
            revert InvalidPriceFeed(address(0));
        }

        (, int256 answer, , , ) = priceFeed.latestRoundData();

        if (answer < 0) {
            revert NegativePrice(answer);
        }
        return normalizePrice(uint256(answer), priceFeed.decimals());
    }

    function getPriceWithHeartbeat(
        AggregatorV3Interface priceFeed,
        uint256 maxAge
    ) internal view returns (PriceData memory priceData) {
        if (address(priceFeed) == address(0)) {
            revert InvalidPriceFeed(address(0));
        }
        uint8 decimals = priceFeed.decimals();
        (uint80 roundId, int256 answer, , uint256 updatedAt, ) = priceFeed
            .latestRoundData();
        if (block.timestamp - updatedAt > maxAge) {
            revert StalePrice(roundId, updatedAt, maxAge);
        }

        if (answer < 0) {
            revert NegativePrice(answer);
        }
        return
            PriceData({
                roundId: roundId,
                price: answer,
                timestamp: updatedAt,
                success: true,
                decimals: decimals
            });
    }

    function getTokenUSDPrice(
        AggregatorV3Interface tokenPriceFeed
    ) internal view returns (uint256 price) {
        return getLatestPrice(tokenPriceFeed);
    }

    function getTokenToTokenPrice(
        AggregatorV3Interface baseTokenPriceFeed,
        AggregatorV3Interface quoteTokenPriceFeed
    ) internal view returns (uint256 price) {
        uint256 basePrice = getLatestPrice(baseTokenPriceFeed);
        uint256 quotePrice = getLatestPrice(quoteTokenPriceFeed);
        return (basePrice * 1e18) / quotePrice;
    }

    function normalizePrice(
        uint256 price,
        uint8 decimals
    ) internal pure returns (uint256 normalizedPrice) {
        if (decimals < 18) {
            return price * 10 ** (18 - decimals);
        } else if (decimals > 18) {
            return price / 10 ** (decimals - 18);
        }
        return price;
    }
}
