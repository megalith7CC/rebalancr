// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IPriceOracle.sol";
import "../libraries/ChainlinkConsumer.sol";

contract ChainlinkPriceOracle is IPriceOracle, Ownable {
    using ChainlinkConsumer for AggregatorV3Interface;

    mapping(address => address) private priceFeeds;
    address public immutable usdPriceFeed;

    event PriceFeedSet(address indexed token, address indexed priceFeed);
    event PriceFeedRemoved(address indexed token);

    error PriceFeedNotFound(address token);
    error InvalidPriceFeed(address priceFeed);
    error ZeroAddress();
    error StalePrice(uint80 roundId, uint256 timestamp, uint256 stalePriceThreshold);
    error NegativePrice(int256 price);

    constructor(address _usdPriceFeed) Ownable(msg.sender) {
        if (_usdPriceFeed == address(0)) revert ZeroAddress();
        usdPriceFeed = _usdPriceFeed;
    }

    function setPriceFeed(address token, address priceFeed) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (priceFeed == address(0)) revert InvalidPriceFeed(priceFeed);

        priceFeeds[token] = priceFeed;
        emit PriceFeedSet(token, priceFeed);
    }

    function removePriceFeed(address token) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (priceFeeds[token] == address(0)) revert PriceFeedNotFound(token);

        delete priceFeeds[token];
        emit PriceFeedRemoved(token);
    }

    function getPriceFeed(address token) external view returns (address) {
        return priceFeeds[token];
    }

    function getLatestPrice(
        address token
    ) external view override returns (uint256 price) {
        address priceFeed = priceFeeds[token];
        if (priceFeed == address(0)) revert PriceFeedNotFound(token);

        return
            ChainlinkConsumer.getLatestPrice(AggregatorV3Interface(priceFeed));
    }

    function getTokenPrice(
        address token,
        address denomination
    ) external view override returns (uint256 price) {
        address tokenFeed = priceFeeds[token];
        address denominationFeed = priceFeeds[denomination];

        if (tokenFeed == address(0)) revert PriceFeedNotFound(token);
        if (denominationFeed == address(0))
            revert PriceFeedNotFound(denomination);

        uint256 tokenPriceInUsd = ChainlinkConsumer.getLatestPrice(
            AggregatorV3Interface(tokenFeed)
        );
        uint256 denominationPriceInUsd = ChainlinkConsumer.getLatestPrice(
            AggregatorV3Interface(denominationFeed)
        );
        return (tokenPriceInUsd * 1e18) / denominationPriceInUsd;
    }
}
