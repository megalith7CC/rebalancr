import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('StrategyRouter', function () {
	const YIELD_STRATEGY = ethers.encodeBytes32String('YIELD_STRATEGY');
	const RISK_STRATEGY = ethers.encodeBytes32String('RISK_STRATEGY');

	const EXECUTE_PERMISSION = ethers.encodeBytes32String('EXECUTE');
	const MANAGE_PERMISSION = ethers.encodeBytes32String('MANAGE');

	async function deployStrategyRouterFixture() {
		const [owner, agent1, agent2, user1, user2] = await ethers.getSigners();

    const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
		const registry = await AgentRegistry.deploy();

    const StrategyRouter = await ethers.getContractFactory('StrategyRouter');
		const router = await StrategyRouter.deploy(await registry.getAddress());
		const MockStrategyAgent = await ethers.getContractFactory('MockStrategyAgent');
		const mockAgent = await MockStrategyAgent.deploy();

    await registry.registerAgent(agent1.address, ethers.encodeBytes32String('EXECUTOR'));
		await registry.registerAgent(agent2.address, ethers.encodeBytes32String('MANAGER'));
		await registry.updateAgentPermissions(agent1.address, [EXECUTE_PERMISSION]);
		await registry.updateAgentPermissions(agent2.address, [MANAGE_PERMISSION]);

		return { router, registry, mockAgent, owner, agent1, agent2, user1, user2 };
	}

	describe('Deployment', function () {
		it('shouldSetTheRightOwner', async function () {
			const { router, owner } = await loadFixture(deployStrategyRouterFixture);
			expect(await router.owner()).to.equal(owner.address);
		});
	});

	describe('StrategyRegistration', function () {
		it('shouldRegisterANewStrategyCorrectly', async function () {
			const { router, mockAgent, owner } = await loadFixture(deployStrategyRouterFixture);

			await expect(router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress()))
				.to.emit(router, 'StrategyRegistered')
				.withArgs(YIELD_STRATEGY, await mockAgent.getAddress());

			expect(await router.isStrategyRegistered(YIELD_STRATEGY)).to.be.true;
			expect(await router.getStrategyImplementation(YIELD_STRATEGY)).to.equal(await mockAgent.getAddress());

			const activeStrategies = await router.getActiveStrategies();
			expect(activeStrategies).to.include(YIELD_STRATEGY);
			expect(activeStrategies).to.have.length(1);
		});

		it('shouldFailToRegisterAStrategyWithEmptyID', async function () {
			const { router, mockAgent } = await loadFixture(deployStrategyRouterFixture);

			await expect(router.registerStrategy(ethers.encodeBytes32String(''), await mockAgent.getAddress()))
				.to.be.revertedWithCustomError(router, 'EmptyBytes32')
				.withArgs('strategyId');
		});

		it('shouldFailToRegisterAStrategyWithZeroAddressImplementation', async function () {
			const { router } = await loadFixture(deployStrategyRouterFixture);

			await expect(router.registerStrategy(YIELD_STRATEGY, ethers.ZeroAddress))
				.to.be.revertedWithCustomError(router, 'ZeroAddress')
				.withArgs('implementation');
		});

		it('shouldFailToRegisterAnAlreadyRegisteredStrategy', async function () {
			const { router, mockAgent } = await loadFixture(deployStrategyRouterFixture);

			await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());

			await expect(router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress()))
				.to.be.revertedWithCustomError(router, 'StrategyAlreadyRegistered')
				.withArgs(YIELD_STRATEGY);
		});

		it('shouldAllowAuthorizedManagerToRegisterStrategy', async function () {
			const { router, mockAgent, agent2 } = await loadFixture(deployStrategyRouterFixture);

			await expect(router.connect(agent2).registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress()))
				.to.emit(router, 'StrategyRegistered')
				.withArgs(YIELD_STRATEGY, await mockAgent.getAddress());
		});

		it('shouldFailWhenUnauthorizedAccountTriesToRegisterStrategy', async function () {
			const { router, mockAgent, agent1, user1 } = await loadFixture(deployStrategyRouterFixture);

			await expect(router.connect(user1).registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress()))
				.to.be.revertedWithCustomError(router, 'Unauthorized')
				.withArgs(user1.address);
			await expect(router.connect(agent1).registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress()))
				.to.be.revertedWithCustomError(router, 'Unauthorized')
				.withArgs(agent1.address);
		});
	});

	describe('StrategyUpdates', function () {
		it('shouldUpdateAStrategyCorrectly', async function () {
			const { router, mockAgent, owner, user1 } = await loadFixture(deployStrategyRouterFixture);
			await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());
			const MockStrategyAgent = await ethers.getContractFactory('MockStrategyAgent');
			const newMockAgent = await MockStrategyAgent.connect(user1).deploy();

			await expect(router.updateStrategy(YIELD_STRATEGY, await newMockAgent.getAddress()))
				.to.emit(router, 'StrategyUpdated')
				.withArgs(YIELD_STRATEGY, await mockAgent.getAddress(), await newMockAgent.getAddress());

			expect(await router.getStrategyImplementation(YIELD_STRATEGY)).to.equal(await newMockAgent.getAddress());
		});

		it('shouldFailToUpdateNonExistentStrategy', async function () {
			const { router, mockAgent } = await loadFixture(deployStrategyRouterFixture);

			await expect(router.updateStrategy(YIELD_STRATEGY, await mockAgent.getAddress()))
				.to.be.revertedWithCustomError(router, 'StrategyNotFound')
				.withArgs(YIELD_STRATEGY);
		});

		it('shouldFailToUpdateStrategyWithZeroAddressImplementation', async function () {
			const { router, mockAgent } = await loadFixture(deployStrategyRouterFixture);

			await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());

			await expect(router.updateStrategy(YIELD_STRATEGY, ethers.ZeroAddress))
				.to.be.revertedWithCustomError(router, 'ZeroAddress')
				.withArgs('newImplementation');
		});

		it('shouldAllowAuthorizedManagerToUpdateStrategy', async function () {
			const { router, mockAgent, agent2 } = await loadFixture(deployStrategyRouterFixture);

			await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());
			const MockStrategyAgent = await ethers.getContractFactory('MockStrategyAgent');
			const newMockAgent = await MockStrategyAgent.deploy();

			await expect(router.connect(agent2).updateStrategy(YIELD_STRATEGY, await newMockAgent.getAddress())).to.emit(
				router,
				'StrategyUpdated'
			);
		});

		it('shouldFailWhenUnauthorizedAccountTriesToUpdateStrategy', async function () {
			const { router, mockAgent, agent1, user1 } = await loadFixture(deployStrategyRouterFixture);

			await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());

			await expect(router.connect(user1).updateStrategy(YIELD_STRATEGY, await mockAgent.getAddress()))
				.to.be.revertedWithCustomError(router, 'Unauthorized')
				.withArgs(user1.address);
			await expect(router.connect(agent1).updateStrategy(YIELD_STRATEGY, await mockAgent.getAddress()))
				.to.be.revertedWithCustomError(router, 'Unauthorized')
				.withArgs(agent1.address);
		});
	});

	describe('StrategyStatus', function () {
		it('shouldPauseStrategyCorrectly', async function () {
			const { router, mockAgent } = await loadFixture(deployStrategyRouterFixture);

			await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());

			await expect(router.pauseStrategy(YIELD_STRATEGY)).to.emit(router, 'StrategyStatusChanged').withArgs(YIELD_STRATEGY, false);

			expect(await router.isStrategyActive(YIELD_STRATEGY)).to.be.false;
		});

		it('shouldUnpauseStrategyCorrectly', async function () {
			const { router, mockAgent } = await loadFixture(deployStrategyRouterFixture);

			await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());
			await router.pauseStrategy(YIELD_STRATEGY);

			await expect(router.unpauseStrategy(YIELD_STRATEGY)).to.emit(router, 'StrategyStatusChanged').withArgs(YIELD_STRATEGY, true);

			expect(await router.isStrategyActive(YIELD_STRATEGY)).to.be.true;
		});

		it('shouldFailToPauseNonExistentStrategy', async function () {
			const { router } = await loadFixture(deployStrategyRouterFixture);

			await expect(router.pauseStrategy(YIELD_STRATEGY))
				.to.be.revertedWithCustomError(router, 'StrategyNotFound')
				.withArgs(YIELD_STRATEGY);
		});

		it('shouldFailToUnpauseNonExistentStrategy', async function () {
			const { router } = await loadFixture(deployStrategyRouterFixture);

			await expect(router.unpauseStrategy(YIELD_STRATEGY))
				.to.be.revertedWithCustomError(router, 'StrategyNotFound')
				.withArgs(YIELD_STRATEGY);
		});

		it('shouldAllowAuthorizedManagerToPauseUnpauseStrategy', async function () {
			const { router, mockAgent, agent2 } = await loadFixture(deployStrategyRouterFixture);

			await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());

			await expect(router.connect(agent2).pauseStrategy(YIELD_STRATEGY)).to.emit(router, 'StrategyStatusChanged');

			await expect(router.connect(agent2).unpauseStrategy(YIELD_STRATEGY)).to.emit(router, 'StrategyStatusChanged');
		});

		it('shouldFailWhenUnauthorizedAccountTriesToPauseUnpauseStrategy', async function () {
			const { router, mockAgent, agent1, user1 } = await loadFixture(deployStrategyRouterFixture);

			await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());

			await expect(router.connect(user1).pauseStrategy(YIELD_STRATEGY))
				.to.be.revertedWithCustomError(router, 'Unauthorized')
				.withArgs(user1.address);

			await expect(router.connect(agent1).pauseStrategy(YIELD_STRATEGY))
				.to.be.revertedWithCustomError(router, 'Unauthorized')
				.withArgs(agent1.address);
		});
	});

	describe('StrategyExecution', function () {
		it('shouldExecuteStrategyCorrectly', async function () {
			const { router, mockAgent, agent1 } = await loadFixture(deployStrategyRouterFixture);
			await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());
			await mockAgent.setExecuteSuccess(true);
			await expect(router.connect(agent1).executeStrategy(YIELD_STRATEGY, '0x'))
				.to.emit(router, 'StrategyExecuted')
				.withArgs(YIELD_STRATEGY, agent1.address, true);
		});

		it('shouldFailToExecuteNonExistentStrategy', async function () {
			const { router, agent1 } = await loadFixture(deployStrategyRouterFixture);

			await expect(router.connect(agent1).executeStrategy(YIELD_STRATEGY, '0x'))
				.to.be.revertedWithCustomError(router, 'StrategyNotFound')
				.withArgs(YIELD_STRATEGY);
		});

		it('shouldFailToExecutePausedStrategy', async function () {
			const { router, mockAgent, agent1 } = await loadFixture(deployStrategyRouterFixture);
			await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());
			await router.pauseStrategy(YIELD_STRATEGY);

			await expect(router.connect(agent1).executeStrategy(YIELD_STRATEGY, '0x'))
				.to.be.revertedWithCustomError(router, 'StrategyPaused')
				.withArgs(YIELD_STRATEGY);
		});

		it('shouldFailWhenUnauthorizedAccountTriesToExecuteStrategy', async function () {
			const { router, mockAgent, user1 } = await loadFixture(deployStrategyRouterFixture);
			await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());

			await expect(router.connect(user1).executeStrategy(YIELD_STRATEGY, '0x'))
				.to.be.revertedWithCustomError(router, 'Unauthorized')
				.withArgs(user1.address);
		});

		it('shouldHandleStrategyExecutionFailure', async function () {
			const { router, mockAgent, agent1 } = await loadFixture(deployStrategyRouterFixture);
			await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());
			await mockAgent.setExecuteSuccess(false);
			await expect(router.connect(agent1).executeStrategy(YIELD_STRATEGY, '0x')).to.be.revertedWithCustomError(
				router,
				'ExecutionFailed'
			);
		});

		describe('StrategyValidation', function () {
			it('shouldValidateParametersCorrectly', async function () {
				const { router, mockAgent } = await loadFixture(deployStrategyRouterFixture);
				await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());
				await mockAgent.setValidateResult(true);

				expect(await router.validateOperation(YIELD_STRATEGY, '0x')).to.be.true;
			});

			it('shouldReturnFalseForInvalidParameters', async function () {
				const { router, mockAgent } = await loadFixture(deployStrategyRouterFixture);
				await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());
				await mockAgent.setValidateResult(false);

				expect(await router.validateOperation(YIELD_STRATEGY, '0x')).to.be.false;
			});

			it('shouldReturnFalseForNonExistentStrategy', async function () {
				const { router } = await loadFixture(deployStrategyRouterFixture);

				expect(await router.validateOperation(YIELD_STRATEGY, '0x')).to.be.false;
			});
		});

		describe('AgentRegistryUpdates', function () {
			it('shouldAllowOwnerToSetNewAgentRegistry', async function () {
				const { router, owner } = await loadFixture(deployStrategyRouterFixture);
				const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
				const newRegistry = await AgentRegistry.deploy();

				await router.setAgentRegistry(await newRegistry.getAddress());
			});

			it('shouldFailWhenNonOwnerTriesToSetAgentRegistry', async function () {
				const { router, user1 } = await loadFixture(deployStrategyRouterFixture);
				const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
				const newRegistry = await AgentRegistry.deploy();

				await expect(router.connect(user1).setAgentRegistry(await newRegistry.getAddress()))
					.to.be.revertedWithCustomError(router, 'OwnableUnauthorizedAccount')
					.withArgs(user1.address);
			});

			it('shouldFailToSetZeroAddressAsAgentRegistry', async function () {
				const { router } = await loadFixture(deployStrategyRouterFixture);

				await expect(router.setAgentRegistry(ethers.ZeroAddress))
					.to.be.revertedWithCustomError(router, 'ZeroAddress')
					.withArgs('agentRegistry');
			});
		});

		describe('MultipleStrategiesManagement', function () {
			it('shouldHandleMultipleStrategiesCorrectly', async function () {
				const { router, mockAgent } = await loadFixture(deployStrategyRouterFixture);
				const MockStrategyAgent = await ethers.getContractFactory('MockStrategyAgent');
				const mockAgent2 = await MockStrategyAgent.deploy();

				await router.registerStrategy(YIELD_STRATEGY, await mockAgent.getAddress());
				await router.registerStrategy(RISK_STRATEGY, await mockAgent2.getAddress());
				
        const activeStrategies = await router.getActiveStrategies();

				expect(activeStrategies).to.have.length(2);
				expect(activeStrategies).to.include(YIELD_STRATEGY);
				expect(activeStrategies).to.include(RISK_STRATEGY);
				expect(await router.getStrategyImplementation(YIELD_STRATEGY)).to.equal(await mockAgent.getAddress());
				expect(await router.getStrategyImplementation(RISK_STRATEGY)).to.equal(await mockAgent2.getAddress());
			});
		});
	});
});
