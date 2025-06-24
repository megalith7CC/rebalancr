// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockFunctionsRouter {
    mapping(bytes32 => bool) public pendingRequests;
    uint256 private _requestCounter;

    event MockRequestSent(bytes32 indexed requestId);
    event MockRequestFulfilled(bytes32 indexed requestId);

    function sendRequest(
        uint64,
        bytes calldata,
        uint16,
        uint32,
        bytes32
    ) external returns (bytes32) {
        bytes32 requestId = keccak256(
            abi.encodePacked(block.timestamp, _requestCounter++, msg.sender)
        );
        pendingRequests[requestId] = true;
        emit MockRequestSent(requestId);
        return requestId;
    }

    function simulateResponse(
        address requester,
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) external {
        require(pendingRequests[requestId], "Request not found");
        pendingRequests[requestId] = false;

        (bool success, ) = requester.call(
            abi.encodeWithSignature(
                "handleOracleFulfillment(bytes32,bytes,bytes)",
                requestId,
                response,
                err
            )
        );

        require(success, "Response simulation failed");
        emit MockRequestFulfilled(requestId);
    }
}
