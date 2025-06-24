// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockStrategyRouter {
    struct ExecutionCall {
        bytes32 strategyId;
        bytes data;
        bool success;
    }

    ExecutionCall[] public executionCalls;
    bool private _shouldSucceed = true;

    event StrategyExecuted(bytes32 indexed strategyId, bytes data);

    function executeStrategy(
        bytes32 strategyId,
        bytes calldata data
    ) external returns (bool) {
        executionCalls.push(
            ExecutionCall({
                strategyId: strategyId,
                data: data,
                success: _shouldSucceed
            })
        );

        emit StrategyExecuted(strategyId, data);

        return _shouldSucceed;
    }

    function setShouldSucceed(bool shouldSucceed) external {
        _shouldSucceed = shouldSucceed;
    }

    function getExecutionCallCount() external view returns (uint256) {
        return executionCalls.length;
    }

    function getExecutionCall(
        uint256 index
    )
        external
        view
        returns (bytes32 strategyId, bytes memory data, bool success)
    {
        require(index < executionCalls.length, "Index out of bounds");
        ExecutionCall storage call = executionCalls[index];
        return (call.strategyId, call.data, call.success);
    }
}
