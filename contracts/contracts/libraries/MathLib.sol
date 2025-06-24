// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library MathLib {
    error DivisionByZero();
    error Overflow();
    uint256 public constant PERCENTAGE_SCALE = 10000;
    uint256 public constant FULL_PERCENT = 10000;
    uint256 public constant HALF_PERCENT = 5000;
    uint256 public constant BASIS_POINTS_SCALE = 10000;

    function calculatePercentage(
        uint256 value,
        uint256 percentage
    ) internal pure returns (uint256 result) {
        if (percentage > PERCENTAGE_SCALE) {
            revert Overflow();
        }
        return (value * percentage) / PERCENTAGE_SCALE;
    }

    function safePercentageOf(
        uint256 value,
        uint256 percentage
    ) internal pure returns (uint256 result) {
        uint256 product;
        unchecked {
            product = value * percentage;
            if (value != 0 && product / value != percentage) {
                revert Overflow();
            }
        }

        return product / PERCENTAGE_SCALE;
    }

    function percentageOf(
        uint256 numerator,
        uint256 denominator
    ) internal pure returns (uint256 percentage) {
        if (denominator == 0) {
            revert DivisionByZero();
        }

        return (numerator * PERCENTAGE_SCALE) / denominator;
    }

    function weightedAverage(
        uint256 value1,
        uint256 weight1,
        uint256 value2,
        uint256 weight2
    ) internal pure returns (uint256 result) {
        uint256 totalWeight = weight1 + weight2;

        if (totalWeight == 0) {
            revert DivisionByZero();
        }

        return ((value1 * weight1) + (value2 * weight2)) / totalWeight;
    }

    function aprToApy(
        uint256 apr,
        uint256 compoundingsPerYear
    ) internal pure returns (uint256 apy) {
        if (compoundingsPerYear == 0) {
            revert DivisionByZero();
        }
        uint256 ratePerPeriod = BASIS_POINTS_SCALE +
            (apr / compoundingsPerYear);
        uint256 result = BASIS_POINTS_SCALE;
        for (uint256 i = 0; i < compoundingsPerYear; i++) {
            result = (result * ratePerPeriod) / BASIS_POINTS_SCALE;
        }
        return result - BASIS_POINTS_SCALE;
    }

    function min3(
        uint256 a,
        uint256 b,
        uint256 c
    ) internal pure returns (uint256 minimum) {
        return a < b ? (a < c ? a : c) : (b < c ? b : c);
    }

    function max3(
        uint256 a,
        uint256 b,
        uint256 c
    ) internal pure returns (uint256 maximum) {
        return a > b ? (a > c ? a : c) : (b > c ? b : c);
    }

    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;

        uint256 z = (x + 1) / 2;
        y = x;

        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
