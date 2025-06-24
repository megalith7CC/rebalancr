// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAccessController {
    function setRoleAdmin(bytes32 role, bytes32 adminRole) external;

    function pause() external;

    function unpause() external;

    function hasAnyRole(
        address account,
        bytes32[] calldata roles
    ) external view returns (bool result);

    function hasAllRoles(
        address account,
        bytes32[] calldata roles
    ) external view returns (bool result);

    function getRolesForAccount(
        address account,
        bytes32[] calldata possibleRoles
    ) external view returns (bytes32[] memory assignedRoles);
}
