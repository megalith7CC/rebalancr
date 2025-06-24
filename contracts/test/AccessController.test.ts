import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('AccessController', () => {
	const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ADMIN_ROLE'));
	const STRATEGY_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('STRATEGY_ADMIN_ROLE'));
	const AGENT_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('AGENT_ADMIN_ROLE'));
	const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('PAUSER_ROLE'));
	const EXECUTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('EXECUTOR_ROLE'));
	const EMERGENCY_ROLE = ethers.keccak256(ethers.toUtf8Bytes('EMERGENCY_ROLE'));
	const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
	async function deployAccessControllerFixture() {
		const [admin, user1, user2, user3] = await ethers.getSigners();

		const AccessControllerFactory = await ethers.getContractFactory('AccessController');
		const accessController = await AccessControllerFactory.deploy(admin.address);

		return {
			accessController,
			admin,
			user1,
			user2,
			user3,
		};
	}
	async function deployWithPauserFixture() {
		const { accessController, admin, user1, user2, user3 } = await loadFixture(deployAccessControllerFixture);
		await accessController.connect(admin).grantRole(PAUSER_ROLE, user1.address);
		return { accessController, admin, user1, user2, user3 };
	}
	async function deployWithRolesFixture() {
		const { accessController, admin, user1, user2, user3 } = await loadFixture(deployAccessControllerFixture);
		await accessController.connect(admin).grantRole(STRATEGY_ADMIN_ROLE, admin.address);
		await accessController.connect(admin).grantRole(STRATEGY_ADMIN_ROLE, user1.address);
		await accessController.connect(admin).grantRole(AGENT_ADMIN_ROLE, user1.address);
		await accessController.connect(admin).grantRole(EXECUTOR_ROLE, user2.address);

		return { accessController, admin, user1, user2, user3 };
	}

	describe('Deployment', () => {
		it('should set admin correctly', async () => {
			const { accessController, admin } = await loadFixture(deployAccessControllerFixture);
			expect(await accessController.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
			expect(await accessController.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
		});

		it('should set role admins correctly', async () => {
			const { accessController } = await loadFixture(deployAccessControllerFixture);
			expect(await accessController.getRoleAdmin(STRATEGY_ADMIN_ROLE)).to.equal(ADMIN_ROLE);
			expect(await accessController.getRoleAdmin(AGENT_ADMIN_ROLE)).to.equal(ADMIN_ROLE);
			expect(await accessController.getRoleAdmin(PAUSER_ROLE)).to.equal(ADMIN_ROLE);
			expect(await accessController.getRoleAdmin(EXECUTOR_ROLE)).to.equal(STRATEGY_ADMIN_ROLE);
			expect(await accessController.getRoleAdmin(EMERGENCY_ROLE)).to.equal(ADMIN_ROLE);
		});

		it('should reject zero address as admin', async () => {
      const AccessControllerFactory = await ethers.getContractFactory('AccessController');
			await expect(AccessControllerFactory.deploy(ethers.ZeroAddress)).to.be.revertedWith('AccessController: admin cannot be zero address');
		});
	});

	describe('Role Administration', () => {
		it('should allow admin to grant roles', async () => {
			const { accessController, admin, user1 } = await loadFixture(deployAccessControllerFixture);
			await accessController.connect(admin).grantRole(STRATEGY_ADMIN_ROLE, user1.address);
			expect(await accessController.hasRole(STRATEGY_ADMIN_ROLE, user1.address)).to.be.true;
		});

		it('should allow admin to revoke roles', async () => {
			const { accessController, admin, user1 } = await loadFixture(deployAccessControllerFixture);
			await accessController.connect(admin).grantRole(STRATEGY_ADMIN_ROLE, user1.address);
			await accessController.connect(admin).revokeRole(STRATEGY_ADMIN_ROLE, user1.address);
			expect(await accessController.hasRole(STRATEGY_ADMIN_ROLE, user1.address)).to.be.false;
		});

		it('should prevent non-admins from granting roles', async () => {
			const { accessController, user1, user2 } = await loadFixture(deployAccessControllerFixture);
			await expect(accessController.connect(user1).grantRole(STRATEGY_ADMIN_ROLE, user2.address)).to.be.reverted;
		});

		it('should allow changing role admins', async () => {
			const { accessController, admin } = await loadFixture(deployAccessControllerFixture);
			await accessController.connect(admin).setRoleAdmin(EXECUTOR_ROLE, ADMIN_ROLE);
			expect(await accessController.getRoleAdmin(EXECUTOR_ROLE)).to.equal(ADMIN_ROLE);
		});

		it('should emit RoleAdminChanged event when changing role admin', async () => {
			const { accessController, admin } = await loadFixture(deployAccessControllerFixture);
			await expect(accessController.connect(admin).setRoleAdmin(EXECUTOR_ROLE, ADMIN_ROLE)).to.emit(accessController, 'RoleAdminChanged').withArgs(EXECUTOR_ROLE, STRATEGY_ADMIN_ROLE, ADMIN_ROLE);
		});
	});

	describe('Pause Functionality', () => {
		it('should allow pauser to pause', async () => {
			const { accessController, user1 } = await loadFixture(deployWithPauserFixture);
			await accessController.connect(user1).pause();
			expect(await accessController.paused()).to.be.true;
		});

		it('should allow pauser to unpause', async () => {
			const { accessController, user1 } = await loadFixture(deployWithPauserFixture);
			await accessController.connect(user1).pause();
			await accessController.connect(user1).unpause();
			expect(await accessController.paused()).to.be.false;
		});

		it('should prevent non-pausers from pausing', async () => {
			const { accessController, user2 } = await loadFixture(deployWithPauserFixture);
			await expect(accessController.connect(user2).pause()).to.be.reverted;
		});
	});

	describe('Role Checking Utilities', () => {
		it('should check if account has any role', async () => {
			const { accessController, user1, user3 } = await loadFixture(deployWithRolesFixture);
			expect(await accessController.hasAnyRole(user1.address, [STRATEGY_ADMIN_ROLE, PAUSER_ROLE])).to.be.true;
			expect(await accessController.hasAnyRole(user3.address, [STRATEGY_ADMIN_ROLE, PAUSER_ROLE])).to.be.false;
		});

		it('should check if account has all roles', async () => {
			const { accessController, user1 } = await loadFixture(deployWithRolesFixture);
			expect(await accessController.hasAllRoles(user1.address, [STRATEGY_ADMIN_ROLE, AGENT_ADMIN_ROLE])).to.be.true;
			expect(await accessController.hasAllRoles(user1.address, [STRATEGY_ADMIN_ROLE, EXECUTOR_ROLE])).to.be.false;
		});

		it('should get all roles for an account', async () => {
			const { accessController, user1 } = await loadFixture(deployWithRolesFixture);
			const roles = await accessController.getRolesForAccount(user1.address, [STRATEGY_ADMIN_ROLE, AGENT_ADMIN_ROLE, EXECUTOR_ROLE, PAUSER_ROLE]);

			expect(roles.length).to.equal(2);
			expect(roles[0]).to.equal(STRATEGY_ADMIN_ROLE);
			expect(roles[1]).to.equal(AGENT_ADMIN_ROLE);
		});
	});
});
