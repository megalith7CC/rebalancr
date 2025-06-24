import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('AgentRegistry', function () {
	const YIELD_AGENT = ethers.encodeBytes32String('YIELD');
	const RISK_AGENT = ethers.encodeBytes32String('RISK');
	const ARBITRAGE_AGENT = ethers.encodeBytes32String('ARBITRAGE');

	const VIEW_ACTION = ethers.encodeBytes32String('VIEW');
	const QUERY_ACTION = ethers.encodeBytes32String('QUERY');
	const CREATE_ACTION = ethers.encodeBytes32String('CREATE');
	const UPDATE_ACTION = ethers.encodeBytes32String('UPDATE');

	async function deployAgentRegistryFixture() {
		const [owner, user1, user2, user3] = await ethers.getSigners();
		const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
		const registry = await AgentRegistry.deploy();

		return { registry, owner, user1, user2, user3 };
	}

	describe('Deployment', function () {
		it('Should set the right owner', async function () {
			const { registry, owner } = await loadFixture(deployAgentRegistryFixture);
			expect(await registry.owner()).to.equal(owner.address);
		});

		it('Should initialize with global permissions', async function () {
			const { registry } = await loadFixture(deployAgentRegistryFixture);
			const globalPermissions = await registry.getGlobalPermissions();
			expect(globalPermissions).to.have.length(2);
			expect(globalPermissions).to.include(VIEW_ACTION);
			expect(globalPermissions).to.include(QUERY_ACTION);
		});
	});

	describe('Agent Registration', function () {
		it('Should register a new agent correctly', async function () {
			const { registry, owner, user1 } = await loadFixture(deployAgentRegistryFixture);

			await expect(registry.registerAgent(user1.address, YIELD_AGENT)).to.emit(registry, 'AgentRegistered').withArgs(user1.address, YIELD_AGENT, owner.address);
			expect(await registry.isAgentRegistered(user1.address)).to.be.true;
			const agentInfo = await registry.getAgentInfo(user1.address);
			expect(agentInfo.agentType).to.equal(YIELD_AGENT);
			expect(agentInfo.isActive).to.be.true;
			expect(agentInfo.owner).to.equal(owner.address);
			const globalPermissions = await registry.getGlobalPermissions();
			const agentPermissions = agentInfo.permissions;
			expect(agentPermissions).to.have.length(globalPermissions.length);
			const registeredAgents = await registry.getRegisteredAgents();
			expect(registeredAgents).to.include(user1.address);
		});

		it('Should fail to register agent with zero address', async function () {
			const { registry } = await loadFixture(deployAgentRegistryFixture);

			await expect(registry.registerAgent(ethers.ZeroAddress, YIELD_AGENT)).to.be.revertedWithCustomError(registry, 'ZeroAddress').withArgs('agentAddress');
		});

		it('Should fail to register agent with empty agent type', async function () {
			const { registry, user1 } = await loadFixture(deployAgentRegistryFixture);

			await expect(registry.registerAgent(user1.address, ethers.encodeBytes32String('')))
				.to.be.revertedWithCustomError(registry, 'EmptyBytes32')
				.withArgs('agentType');
		});

		it('Should fail to register already registered agent', async function () {
			const { registry, user1 } = await loadFixture(deployAgentRegistryFixture);

			await registry.registerAgent(user1.address, YIELD_AGENT);

			await expect(registry.registerAgent(user1.address, RISK_AGENT)).to.be.revertedWithCustomError(registry, 'AgentAlreadyRegistered').withArgs(user1.address);
		});

		it('Should only allow owner to register agents', async function () {
			const { registry, user1, user2 } = await loadFixture(deployAgentRegistryFixture);

			await expect(registry.connect(user1).registerAgent(user2.address, YIELD_AGENT)).to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount').withArgs(user1.address);
		});
	});

	describe('Agent Deregistration', function () {
		it('Should deregister an agent correctly', async function () {
			const { registry, owner, user1 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			await expect(registry.deregisterAgent(user1.address)).to.emit(registry, 'AgentDeregistered').withArgs(user1.address).to.emit(registry, 'AgentStatusChanged').withArgs(user1.address, false);
			expect(await registry.isAgentActive(user1.address)).to.be.false;
			expect(await registry.isAgentActive(user1.address)).to.be.false;
			const registeredAgents = await registry.getRegisteredAgents();
			expect(registeredAgents).not.to.include(user1.address);
		});

		it('Should allow agent owner to deregister their agent', async function () {
			const { registry, owner, user1, user2 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			await registry.transferAgentOwnership(user1.address, user2.address);
			await expect(registry.connect(user2).deregisterAgent(user1.address)).to.emit(registry, 'AgentDeregistered').withArgs(user1.address);
		});

		it('Should fail to deregister agent with zero address', async function () {
			const { registry } = await loadFixture(deployAgentRegistryFixture);

			await expect(registry.deregisterAgent(ethers.ZeroAddress)).to.be.revertedWithCustomError(registry, 'ZeroAddress').withArgs('agentAddress');
		});

		it('Should fail to deregister non-registered agent', async function () {
			const { registry, user1 } = await loadFixture(deployAgentRegistryFixture);

			await expect(registry.deregisterAgent(user1.address)).to.be.revertedWithCustomError(registry, 'AgentNotRegistered').withArgs(user1.address);
		});

		it('Should fail when unauthorized account tries to deregister', async function () {
			const { registry, user1, user2 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			await expect(registry.connect(user2).deregisterAgent(user1.address)).to.be.revertedWithCustomError(registry, 'Unauthorized').withArgs(user2.address);
		});
	});

	describe('Agent Authorization', function () {
		it('Should authorize agent for global permissions', async function () {
			const { registry, user1 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			expect(await registry.isAuthorized(user1.address, VIEW_ACTION)).to.be.true;
			expect(await registry.isAuthorized(user1.address, QUERY_ACTION)).to.be.true;
		});

		it('Should not authorize for non-granted permissions', async function () {
			const { registry, user1 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			expect(await registry.isAuthorized(user1.address, CREATE_ACTION)).to.be.false;
		});

		it('Should authorize after permission update', async function () {
			const { registry, user1 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			const newPermissions = [VIEW_ACTION, QUERY_ACTION, CREATE_ACTION];
			await registry.updateAgentPermissions(user1.address, newPermissions);
			expect(await registry.isAuthorized(user1.address, CREATE_ACTION)).to.be.true;
		});

		it('Should not authorize inactive agents', async function () {
			const { registry, user1 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			await registry.setAgentStatus(user1.address, false);
			expect(await registry.isAuthorized(user1.address, VIEW_ACTION)).to.be.false;
		});

		it('Should not authorize non-registered agents', async function () {
			const { registry, user1 } = await loadFixture(deployAgentRegistryFixture);
			expect(await registry.isAuthorized(user1.address, VIEW_ACTION)).to.be.false;
		});

		it('Should handle zero address or empty action properly', async function () {
			const { registry, user1 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			expect(await registry.isAuthorized(ethers.ZeroAddress, VIEW_ACTION)).to.be.false;
			expect(await registry.isAuthorized(user1.address, ethers.encodeBytes32String(''))).to.be.false;
		});
	});

	describe('Agent Permissions', function () {
		it('Should update agent permissions correctly', async function () {
			const { registry, owner, user1 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			const newPermissions = [VIEW_ACTION, QUERY_ACTION, CREATE_ACTION, UPDATE_ACTION];
			await expect(registry.updateAgentPermissions(user1.address, newPermissions)).to.emit(registry, 'AgentPermissionsUpdated').withArgs(user1.address, newPermissions);
			const agentInfo = await registry.getAgentInfo(user1.address);
			expect(agentInfo.permissions).to.have.length(4);
			expect(agentInfo.permissions).to.include(CREATE_ACTION);
			expect(agentInfo.permissions).to.include(UPDATE_ACTION);
		});

		it('Should allow agent owner to update permissions', async function () {
			const { registry, user1, user2 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			await registry.transferAgentOwnership(user1.address, user2.address);
			const newPermissions = [VIEW_ACTION, CREATE_ACTION];
			await expect(registry.connect(user2).updateAgentPermissions(user1.address, newPermissions)).to.emit(registry, 'AgentPermissionsUpdated').withArgs(user1.address, newPermissions);
		});

		it('Should fail to update permissions for non-registered agent', async function () {
			const { registry, user1 } = await loadFixture(deployAgentRegistryFixture);

			await expect(registry.updateAgentPermissions(user1.address, [VIEW_ACTION]))
				.to.be.revertedWithCustomError(registry, 'AgentNotRegistered')
				.withArgs(user1.address);
		});

		it('Should fail when unauthorized account tries to update permissions', async function () {
			const { registry, user1, user2 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			await expect(registry.connect(user2).updateAgentPermissions(user1.address, [VIEW_ACTION, CREATE_ACTION]))
				.to.be.revertedWithCustomError(registry, 'Unauthorized')
				.withArgs(user2.address);
		});
	});

	describe('Global Permissions', function () {
		it('Should add global permission correctly', async function () {
			const { registry, owner } = await loadFixture(deployAgentRegistryFixture);
			await registry.addGlobalPermission(CREATE_ACTION);
			const globalPermissions = await registry.getGlobalPermissions();
			expect(globalPermissions).to.include(CREATE_ACTION);
			expect(globalPermissions).to.have.length(3);
		});

		it('Should remove global permission correctly', async function () {
			const { registry, owner } = await loadFixture(deployAgentRegistryFixture);
			await registry.removeGlobalPermission(VIEW_ACTION);
			const globalPermissions = await registry.getGlobalPermissions();
			expect(globalPermissions).not.to.include(VIEW_ACTION);
			expect(globalPermissions).to.have.length(1);
		});

		it('Should only allow owner to manage global permissions', async function () {
			const { registry, user1 } = await loadFixture(deployAgentRegistryFixture);
			await expect(registry.connect(user1).addGlobalPermission(CREATE_ACTION)).to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount').withArgs(user1.address);
			await expect(registry.connect(user1).removeGlobalPermission(VIEW_ACTION)).to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount').withArgs(user1.address);
		});
	});

	describe('Agent Status', function () {
		it('Should set agent status correctly', async function () {
			const { registry, owner, user1 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			await expect(registry.setAgentStatus(user1.address, false)).to.emit(registry, 'AgentStatusChanged').withArgs(user1.address, false);
			expect(await registry.isAgentActive(user1.address)).to.be.false;
			await expect(registry.setAgentStatus(user1.address, true)).to.emit(registry, 'AgentStatusChanged').withArgs(user1.address, true);
			expect(await registry.isAgentActive(user1.address)).to.be.true;
		});

		it('Should allow agent owner to set status', async function () {
			const { registry, user1, user2 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			await registry.transferAgentOwnership(user1.address, user2.address);
			await expect(registry.connect(user2).setAgentStatus(user1.address, false)).to.emit(registry, 'AgentStatusChanged').withArgs(user1.address, false);
		});

		it('Should fail to set status for non-registered agent', async function () {
			const { registry, user1 } = await loadFixture(deployAgentRegistryFixture);

			await expect(registry.setAgentStatus(user1.address, false)).to.be.revertedWithCustomError(registry, 'AgentNotRegistered').withArgs(user1.address);
		});

		it('Should fail when unauthorized account tries to set status', async function () {
			const { registry, user1, user2 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			await expect(registry.connect(user2).setAgentStatus(user1.address, false)).to.be.revertedWithCustomError(registry, 'Unauthorized').withArgs(user2.address);
		});
	});

	describe('Agent Ownership', function () {
		it('Should transfer ownership correctly', async function () {
			const { registry, owner, user1, user2 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			await expect(registry.transferAgentOwnership(user1.address, user2.address)).to.emit(registry, 'AgentOwnershipTransferred').withArgs(user1.address, owner.address, user2.address);
			expect(await registry.getAgentOwner(user1.address)).to.equal(user2.address);
		});

		it('Should allow agent owner to transfer ownership', async function () {
			const { registry, owner, user1, user2, user3 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			await registry.transferAgentOwnership(user1.address, user2.address);
			await expect(registry.connect(user2).transferAgentOwnership(user1.address, user3.address)).to.emit(registry, 'AgentOwnershipTransferred').withArgs(user1.address, user2.address, user3.address);
			expect(await registry.getAgentOwner(user1.address)).to.equal(user3.address);
		});

		it('Should fail to transfer ownership of non-registered agent', async function () {
			const { registry, user1, user2 } = await loadFixture(deployAgentRegistryFixture);

			await expect(registry.transferAgentOwnership(user1.address, user2.address)).to.be.revertedWithCustomError(registry, 'AgentNotRegistered').withArgs(user1.address);
		});

		it('Should fail to transfer ownership to zero address', async function () {
			const { registry, user1 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);

			await expect(registry.transferAgentOwnership(user1.address, ethers.ZeroAddress)).to.be.revertedWithCustomError(registry, 'ZeroAddress').withArgs('newOwner');
		});

		it('Should fail when unauthorized account tries to transfer ownership', async function () {
			const { registry, user1, user2, user3 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			await expect(registry.connect(user3).transferAgentOwnership(user1.address, user2.address)).to.be.revertedWithCustomError(registry, 'Unauthorized').withArgs(user3.address);
		});
	});

	describe('Agent Queries', function () {
		it('Should return correct agent info', async function () {
			const { registry, owner, user1 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			const agentInfo = await registry.getAgentInfo(user1.address);
			expect(agentInfo.agentType).to.equal(YIELD_AGENT);
			expect(agentInfo.isActive).to.be.true;
			expect(agentInfo.owner).to.equal(owner.address);
			expect(agentInfo.registeredAt).to.not.equal(0);
		});

		it('Should return all registered agents', async function () {
			const { registry, user1, user2, user3 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			await registry.registerAgent(user2.address, RISK_AGENT);
			await registry.registerAgent(user3.address, ARBITRAGE_AGENT);
			const registeredAgents = await registry.getRegisteredAgents();
			expect(registeredAgents).to.include(user1.address);
			expect(registeredAgents).to.include(user2.address);
			expect(registeredAgents).to.include(user3.address);
			expect(registeredAgents).to.have.length(3);
		});

		it('Should return agents by type', async function () {
			const { registry, user1, user2, user3 } = await loadFixture(deployAgentRegistryFixture);
			await registry.registerAgent(user1.address, YIELD_AGENT);
			await registry.registerAgent(user2.address, RISK_AGENT);
			await registry.registerAgent(user3.address, YIELD_AGENT);
			const yieldAgents = await registry.getAgentsByType(YIELD_AGENT);
			expect(yieldAgents).to.include(user1.address);
			expect(yieldAgents).to.include(user3.address);
			expect(yieldAgents).to.have.length(2);

			const riskAgents = await registry.getAgentsByType(RISK_AGENT);
			expect(riskAgents).to.include(user2.address);
			expect(riskAgents).to.have.length(1);
		});

		it('Should handle empty results for agent queries', async function () {
			const { registry } = await loadFixture(deployAgentRegistryFixture);
			const nonExistentTypeAgents = await registry.getAgentsByType(ARBITRAGE_AGENT);
			expect(nonExistentTypeAgents).to.have.length(0);
			const registeredAgents = await registry.getRegisteredAgents();
			expect(registeredAgents).to.have.length(0);
		});

		it('Should fail to get info for non-registered agent', async function () {
			const { registry, user1 } = await loadFixture(deployAgentRegistryFixture);

			await expect(registry.getAgentInfo(user1.address)).to.be.revertedWithCustomError(registry, 'AgentNotRegistered');
		});
	});
});
