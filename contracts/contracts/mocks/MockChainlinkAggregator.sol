// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract MockChainlinkAggregator is AggregatorV3Interface {
    uint8 private _decimals = 8;
    string private _description = "Mock Price Feed";
    uint256 private _version = 1;

    int256 private _latestAnswer;
    uint80 private _latestRound = 1;
    uint256 private _latestTimestamp;

    constructor(uint8 decimals_, string memory description_) {
        _decimals = decimals_;
        _description = description_;
        _latestTimestamp = block.timestamp;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function description() external view override returns (string memory) {
        return _description;
    }

    function version() external view override returns (uint256) {
        return _version;
    }

    function getRoundData(
        uint80 _roundId
    )
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        require(_roundId <= _latestRound, "Round not complete");

        return (
            _roundId,
            _latestAnswer,
            _latestTimestamp,
            _latestTimestamp,
            _roundId
        );
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            _latestRound,
            _latestAnswer,
            _latestTimestamp,
            _latestTimestamp,
            _latestRound
        );
    }

    function updateAnswer(int256 answer) external {
        _latestAnswer = answer;
        _latestTimestamp = block.timestamp;
        _latestRound++;
    }

    function setLatestAnswer(int256 answer) external {
        _latestAnswer = answer;
        _latestTimestamp = block.timestamp;
        _latestRound++;
    }

    function setDecimals(uint8 decimals_) external {
        _decimals = decimals_;
    }
}
