// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../interfaces/IAccessController.sol";

contract AccessController is IAccessController, AccessControl, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant STRATEGY_ADMIN_ROLE = keccak256("STRATEGY_ADMIN_ROLE");
    bytes32 public constant AGENT_ADMIN_ROLE = keccak256("AGENT_ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    constructor(address admin) {
        require(
            admin != address(0),
            "AccessController: admin cannot be zero address"
        );
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _setRoleAdmin(STRATEGY_ADMIN_ROLE, ADMIN_ROLE);
        _setRoleAdmin(AGENT_ADMIN_ROLE, ADMIN_ROLE);
        _setRoleAdmin(PAUSER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(EXECUTOR_ROLE, STRATEGY_ADMIN_ROLE);
        _setRoleAdmin(EMERGENCY_ROLE, ADMIN_ROLE);
    }

    function setRoleAdmin(
        bytes32 role,
        bytes32 adminRole
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 previousAdminRole = getRoleAdmin(role);
        _setRoleAdmin(role, adminRole);
        emit RoleAdminChanged(role, previousAdminRole, adminRole);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function hasAnyRole(
        address account,
        bytes32[] calldata roles
    ) external view returns (bool result) {
        for (uint256 i = 0; i < roles.length; i++) {
            if (hasRole(roles[i], account)) {
                return true;
            }
        }
        return false;
    }

    function hasAllRoles(
        address account,
        bytes32[] calldata roles
    ) external view returns (bool result) {
        for (uint256 i = 0; i < roles.length; i++) {
            if (!hasRole(roles[i], account)) {
                return false;
            }
        }
        return true;
    }

    function getRolesForAccount(
        address account,
        bytes32[] calldata possibleRoles
    ) external view returns (bytes32[] memory assignedRoles) {
        uint256 count = 0;
        for (uint256 i = 0; i < possibleRoles.length; i++) {
            if (hasRole(possibleRoles[i], account)) {
                count++;
            }
        }
        bytes32[] memory result = new bytes32[](count);
        uint256 index = 0;

        for (uint256 i = 0; i < possibleRoles.length; i++) {
            if (hasRole(possibleRoles[i], account)) {
                result[index] = possibleRoles[i];
                index++;
            }
        }

        return result;
    }
}
