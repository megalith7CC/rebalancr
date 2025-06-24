// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library ProtocolConstants {
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant BASIS_POINTS_SCALE = 10000;
    uint256 public constant DEFAULT_PERFORMANCE_FEE = 1000;
    uint256 public constant DEFAULT_MANAGEMENT_FEE = 200;
    uint256 public constant MAX_PERFORMANCE_FEE = 3000;
    uint256 public constant MAX_MANAGEMENT_FEE = 500;
    bytes32 public constant RISK_LEVEL_LOW = "LOW";
    bytes32 public constant RISK_LEVEL_MEDIUM = "MEDIUM";
    bytes32 public constant RISK_LEVEL_HIGH = "HIGH";
    bytes32 public constant STRATEGY_TYPE_YIELD = "YIELD";
    bytes32 public constant STRATEGY_TYPE_ARBITRAGE = "ARBITRAGE";
    bytes32 public constant STRATEGY_TYPE_LIQUIDITY = "LIQUIDITY";
    bytes32 public constant AGENT_TYPE_YIELD = "YIELD_AGENT";
    bytes32 public constant AGENT_TYPE_RISK = "RISK_AGENT";
    bytes32 public constant AGENT_TYPE_ARBITRAGE = "ARBITRAGE_AGENT";
    bytes32 public constant AGENT_TYPE_MONITORING = "MONITORING_AGENT";
    uint256 public constant UPGRADE_TIMELOCK = 2 days;
    uint256 public constant DEFAULT_PRICE_FEED_HEARTBEAT = 1 hours;
    uint256 public constant MAX_PRICE_FEED_AGE = 24 hours;
    uint256 public constant SLIPPAGE_TOLERANCE_DEFAULT = 100;
    uint256 public constant MAX_SLIPPAGE_TOLERANCE = 1000;
    uint256 public constant MIN_POSITION_VALUE = 10e18;
    uint256 public constant MAX_TOKENS_PER_POSITION = 10;
    bytes32 public constant PROTOCOL_AAVE = "AAVE";
    bytes32 public constant PROTOCOL_COMPOUND = "COMPOUND";
    bytes32 public constant PROTOCOL_UNISWAP = "UNISWAP";
    bytes32 public constant PROTOCOL_CURVE = "CURVE";
    address public constant ETH_ADDRESS =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
}
