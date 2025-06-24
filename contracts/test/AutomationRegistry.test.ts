import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { BigNumberish, EventLog } from 'ethers';

describe('AutomationRegistry', function () {
	const AUTOMATION_ADMIN_PERMISSION = ethers.id('AUTOMATION_ADMIN');
	const AUTOMATION_EXECUTE_PERMISSION = ethers.id('AUTOMATION_EXECUTE');
	const TEST_AUTOMATION_NAME = 'Test Automation';
	const AGENT_TYPE = ethers.id('TEST_AGENT');
	const EXECUTOR = ethers.id('EXECUTOR');
	const TEST_INTERVAL = 3600;
	const GAS_LIMIT = 500000;
	const MINIMUM_FUNDING = ethers.parseEther('1');
	const TIME_TRIGGER_CONFIG = ethers.toUtf8Bytes('time_config');
	const PRICE_TRIGGER_CONFIG = ethers.toUtf8Bytes('price_config');
	const EXECUTE_DATA = ethers.toUtf8Bytes('execute_data');

	async function deployAutomationRegistryFixture() {
		const [owner, admin, executor, user] = await ethers.getSigners();
		const MockToken = await ethers.getContractFactory('MockERC20');
		const linkToken = await MockToken.deploy('ChainLink Token', 'LINK', 18);
		await linkToken.waitForDeployment();
		await linkToken.mint(admin.address, ethers.parseEther('100'));
		await linkToken.mint(user.address, ethers.parseEther('100'));
		const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
		const agentRegistry = await AgentRegistry.deploy();
		await agentRegistry.waitForDeployment();
		const MockChainlinkRegistry = await ethers.getContractFactory('MockContract');
		const chainlinkRegistry = await MockChainlinkRegistry.deploy();
		await chainlinkRegistry.waitForDeployment();
		const AutomationRegistry = await ethers.getContractFactory('AutomationRegistry');
		const automationRegistry = await AutomationRegistry.deploy(
			await chainlinkRegistry.getAddress(),
			await linkToken.getAddress(),
			await agentRegistry.getAddress(),
			MINIMUM_FUNDING
		);
		await automationRegistry.waitForDeployment();
		const MockAutomationTarget = await ethers.getContractFactory('MockAutomationTarget');
		const mockTarget = await MockAutomationTarget.deploy();
		await mockTarget.waitForDeployment();
		await agentRegistry.registerAgent(admin.address, AGENT_TYPE);
		await agentRegistry.registerAgent(executor.address, EXECUTOR);
		await agentRegistry.connect(owner).updateAgentPermissions(admin.address, [AUTOMATION_ADMIN_PERMISSION]);
		await agentRegistry.connect(owner).updateAgentPermissions(executor.address, [AUTOMATION_EXECUTE_PERMISSION]);

		return {
			automationRegistry,
			agentRegistry,
			linkToken,
			chainlinkRegistry,
			mockTarget,
			owner,
			admin,
			executor,
			user,
		};
	}

	describe('Deployment', function () {
		it('Should set the correct owner', async function () {
			const { automationRegistry, owner } = await loadFixture(deployAutomationRegistryFixture);
			expect(await automationRegistry.owner()).to.equal(owner.address);
		});

		it('Should initialize with correct dependencies', async function () {
			const { automationRegistry, linkToken, chainlinkRegistry, agentRegistry } = await loadFixture(
				deployAutomationRegistryFixture
			);

			expect(await automationRegistry.linkToken()).to.equal(await linkToken.getAddress());
			expect(await automationRegistry.chainlinkRegistry()).to.equal(await chainlinkRegistry.getAddress());
			expect(await automationRegistry.agentRegistry()).to.equal(await agentRegistry.getAddress());
			expect(await automationRegistry.minimumAutomationFunding()).to.equal(MINIMUM_FUNDING);
		});

		it('Should fail deployment with zero address chainlink registry', async function () {
			const { agentRegistry, linkToken } = await loadFixture(deployAutomationRegistryFixture);
			const AutomationRegistry = await ethers.getContractFactory('AutomationRegistry');

			await expect(
				AutomationRegistry.deploy(
					ethers.ZeroAddress,
					await linkToken.getAddress(),
					await agentRegistry.getAddress(),
					MINIMUM_FUNDING
				)
			).to.be.revertedWithCustomError(AutomationRegistry, 'ZeroAddress');
		});

		it('Should fail deployment with zero address link token', async function () {
			const { agentRegistry, chainlinkRegistry } = await loadFixture(deployAutomationRegistryFixture);
			const AutomationRegistry = await ethers.getContractFactory('AutomationRegistry');

			await expect(
				AutomationRegistry.deploy(
					await chainlinkRegistry.getAddress(),
					ethers.ZeroAddress,
					await agentRegistry.getAddress(),
					MINIMUM_FUNDING
				)
			).to.be.revertedWithCustomError(AutomationRegistry, 'ZeroAddress');
		});

		it('Should fail deployment with zero address agent registry', async function () {
			const { linkToken, chainlinkRegistry } = await loadFixture(deployAutomationRegistryFixture);
			const AutomationRegistry = await ethers.getContractFactory('AutomationRegistry');

			await expect(
				AutomationRegistry.deploy(
					await chainlinkRegistry.getAddress(),
					await linkToken.getAddress(),
					ethers.ZeroAddress,
					MINIMUM_FUNDING
				)
			).to.be.revertedWithCustomError(AutomationRegistry, 'ZeroAddress');
		});

		it('Should fail deployment with zero minimum funding', async function () {
			const { agentRegistry, chainlinkRegistry, linkToken } = await loadFixture(deployAutomationRegistryFixture);
			const AutomationRegistry = await ethers.getContractFactory('AutomationRegistry');

			await expect(
				AutomationRegistry.deploy(
					await chainlinkRegistry.getAddress(),
					await linkToken.getAddress(),
					await agentRegistry.getAddress(),
					0
				)
			).to.be.revertedWithCustomError(AutomationRegistry, 'ZeroValue');
		});
	});

	describe('Automation Registration', function () {
		it('Should allow authorized agent to register a time-based automation', async function () {
			const { automationRegistry, admin, mockTarget } = await loadFixture(deployAutomationRegistryFixture);
			const targetAddress = await mockTarget.getAddress();

			const tx = await automationRegistry
				.connect(admin)
				.registerAutomation(TEST_AUTOMATION_NAME, 0, TIME_TRIGGER_CONFIG, targetAddress, EXECUTE_DATA, 0, TEST_INTERVAL, GAS_LIMIT);

			const receipt = await tx.wait();
			const event = receipt?.logs.find((log) => log instanceof EventLog && log.eventName === 'AutomationRegistered') as EventLog;

			expect(event).to.not.be.undefined;
			const automationId = event.args[0];
			const automationConfig = await automationRegistry.getAutomationConfig(automationId);
			
      expect(automationConfig.name).to.equal(TEST_AUTOMATION_NAME);
			expect(automationConfig.triggerType).to.equal(0);
			expect(ethers.hexlify(automationConfig.triggerConfig)).to.equal(ethers.hexlify(TIME_TRIGGER_CONFIG));
			expect(automationConfig.target).to.equal(targetAddress);
			expect(ethers.hexlify(automationConfig.executeData)).to.equal(ethers.hexlify(EXECUTE_DATA));
			expect(automationConfig.interval).to.equal(TEST_INTERVAL);
			expect(automationConfig.isActive).to.equal(false);
			expect(automationConfig.executionCount).to.equal(0);
			expect(automationConfig.gasLimit).to.equal(GAS_LIMIT);
		});

		it('Should allow authorized agent to register a price-deviation automation', async function () {
			const { automationRegistry, admin, mockTarget } = await loadFixture(deployAutomationRegistryFixture);
			const targetAddress = await mockTarget.getAddress();

			const tx = await automationRegistry
				.connect(admin)
				.registerAutomation(
					TEST_AUTOMATION_NAME,
					1,
					PRICE_TRIGGER_CONFIG,
					targetAddress,
					EXECUTE_DATA,
					0,
					TEST_INTERVAL,
					GAS_LIMIT
				);

			const receipt = await tx.wait();
			const event = receipt?.logs.find((log) => log instanceof EventLog && log.eventName === 'AutomationRegistered') as EventLog;

			expect(event).to.not.be.undefined;
			const automationId = event.args[0];
			const automationConfig = await automationRegistry.getAutomationConfig(automationId);
			expect(automationConfig.triggerType).to.equal(1);
		});

		it('Should prevent unauthorized users from registering automation', async function () {
			const { automationRegistry, user, mockTarget } = await loadFixture(deployAutomationRegistryFixture);
			const targetAddress = await mockTarget.getAddress();

			await expect(
				automationRegistry
					.connect(user)
					.registerAutomation(
						TEST_AUTOMATION_NAME,
						0,
						TIME_TRIGGER_CONFIG,
						targetAddress,
						EXECUTE_DATA,
						0,
						TEST_INTERVAL,
						GAS_LIMIT
					)
			).to.be.revertedWithCustomError(automationRegistry, 'UnauthorizedCaller');
		});

		it('Should reject registration with zero target address', async function () {
			const { automationRegistry, admin } = await loadFixture(deployAutomationRegistryFixture);

			await expect(
				automationRegistry
					.connect(admin)
					.registerAutomation(
						TEST_AUTOMATION_NAME,
						0,
						TIME_TRIGGER_CONFIG,
						ethers.ZeroAddress,
						EXECUTE_DATA,
						0,
						TEST_INTERVAL,
						GAS_LIMIT
					)
			).to.be.revertedWithCustomError(automationRegistry, 'ZeroAddress');
		});

		it('Should reject registration with empty trigger config', async function () {
			const { automationRegistry, admin, mockTarget } = await loadFixture(deployAutomationRegistryFixture);
			const targetAddress = await mockTarget.getAddress();

			await expect(
				automationRegistry
					.connect(admin)
					.registerAutomation(TEST_AUTOMATION_NAME, 0, '0x', targetAddress, EXECUTE_DATA, 0, TEST_INTERVAL, GAS_LIMIT)
			).to.be.revertedWithCustomError(automationRegistry, 'EmptyBytes');
		});

		it('Should reject registration with empty execute data', async function () {
			const { automationRegistry, admin, mockTarget } = await loadFixture(deployAutomationRegistryFixture);
			const targetAddress = await mockTarget.getAddress();

			await expect(
				automationRegistry
					.connect(admin)
					.registerAutomation(TEST_AUTOMATION_NAME, 0, TIME_TRIGGER_CONFIG, targetAddress, '0x', 0, TEST_INTERVAL, GAS_LIMIT)
			).to.be.revertedWithCustomError(automationRegistry, 'EmptyBytes');
		});

		it('Should reject registration with invalid interval', async function () {
			const { automationRegistry, admin, mockTarget } = await loadFixture(deployAutomationRegistryFixture);
			const targetAddress = await mockTarget.getAddress();

			await expect(
				automationRegistry
					.connect(admin)
					.registerAutomation(TEST_AUTOMATION_NAME, 0, TIME_TRIGGER_CONFIG, targetAddress, EXECUTE_DATA, 0, 30, GAS_LIMIT)
			).to.be.revertedWithCustomError(automationRegistry, 'InvalidInterval');
		});

		it('Should reject registration with insufficient gas limit', async function () {
			const { automationRegistry, admin, mockTarget } = await loadFixture(deployAutomationRegistryFixture);
			const targetAddress = await mockTarget.getAddress();

			await expect(
				automationRegistry
					.connect(admin)
					.registerAutomation(TEST_AUTOMATION_NAME, 0, TIME_TRIGGER_CONFIG, targetAddress, EXECUTE_DATA, 0, TEST_INTERVAL, 50000)
			).to.be.revertedWithCustomError(automationRegistry, 'InvalidGasLimit');
		});
	});

	describe('Automation Funding and Activation', function () {
		it('Should allow funding an automation', async function () {
			const { automationRegistry, linkToken, admin, mockTarget } = await loadFixture(deployAutomationRegistryFixture);
			const targetAddress = await mockTarget.getAddress();
			const tx = await automationRegistry
				.connect(admin)
				.registerAutomation(TEST_AUTOMATION_NAME, 0, TIME_TRIGGER_CONFIG, targetAddress, EXECUTE_DATA, 0, TEST_INTERVAL, GAS_LIMIT);
			const receipt = await tx.wait();
			const event = receipt?.logs.find((log) => log instanceof EventLog && log.eventName === 'AutomationRegistered') as EventLog;
			const automationId = event.args[0];
			const fundAmount = ethers.parseEther('2');
			await linkToken.connect(admin).approve(await automationRegistry.getAddress(), fundAmount);

			await expect(automationRegistry.connect(admin).fundAutomation(automationId, fundAmount))
				.to.emit(automationRegistry, 'AutomationFunded')
				.withArgs(automationId, fundAmount);
			expect(await automationRegistry.getAutomationBalance(automationId)).to.equal(fundAmount);
		});

		it('Should allow activation after sufficient funding', async function () {
			const { automationRegistry, linkToken, admin, mockTarget } = await loadFixture(deployAutomationRegistryFixture);
			const targetAddress = await mockTarget.getAddress();
			const tx = await automationRegistry
				.connect(admin)
				.registerAutomation(TEST_AUTOMATION_NAME, 0, TIME_TRIGGER_CONFIG, targetAddress, EXECUTE_DATA, 0, TEST_INTERVAL, GAS_LIMIT);
			const receipt = await tx.wait();
			const event = receipt?.logs.find((log) => log instanceof EventLog && log.eventName === 'AutomationRegistered') as EventLog;
			const automationId = event.args[0];
			const fundAmount = ethers.parseEther('2');
			await linkToken.connect(admin).approve(await automationRegistry.getAddress(), fundAmount);
			await automationRegistry.connect(admin).fundAutomation(automationId, fundAmount);
			await expect(automationRegistry.connect(admin).activateAutomation(automationId))
				.to.emit(automationRegistry, 'AutomationStatusChanged')
				.withArgs(automationId, true);
			const config = await automationRegistry.getAutomationConfig(automationId);
			expect(config.isActive).to.equal(true);
		});

		it('Should prevent activation without sufficient funding', async function () {
			const { automationRegistry, admin, mockTarget } = await loadFixture(deployAutomationRegistryFixture);
			const targetAddress = await mockTarget.getAddress();
			const tx = await automationRegistry
				.connect(admin)
				.registerAutomation(TEST_AUTOMATION_NAME, 0, TIME_TRIGGER_CONFIG, targetAddress, EXECUTE_DATA, 0, TEST_INTERVAL, GAS_LIMIT);
			const receipt = await tx.wait();
			const event = receipt?.logs.find((log) => log instanceof EventLog && log.eventName === 'AutomationRegistered') as EventLog;
			const automationId = event.args[0];
			await expect(automationRegistry.connect(admin).activateAutomation(automationId)).to.be.revertedWithCustomError(
				automationRegistry,
				'InsufficientFunding'
			);
		});
	});

	describe('Automation Management', function () {
		async function setupActiveAutomation() {
			const fixture = await loadFixture(deployAutomationRegistryFixture);
			const { automationRegistry, linkToken, admin, mockTarget } = fixture;
			const targetAddress = await mockTarget.getAddress();
			const tx = await automationRegistry
				.connect(admin)
				.registerAutomation(TEST_AUTOMATION_NAME, 0, TIME_TRIGGER_CONFIG, targetAddress, EXECUTE_DATA, 0, TEST_INTERVAL, GAS_LIMIT);
			const receipt = await tx.wait();
			const event = receipt?.logs.find((log) => log instanceof EventLog && log.eventName === 'AutomationRegistered') as EventLog;
			const automationId = event.args[0];
			const fundAmount = ethers.parseEther('2');
			await linkToken.connect(admin).approve(await automationRegistry.getAddress(), fundAmount);
			await automationRegistry.connect(admin).fundAutomation(automationId, fundAmount);
			await automationRegistry.connect(admin).activateAutomation(automationId);

			return { ...fixture, automationId };
		}

		it('Should allow updating automation configuration', async function () {
			const { automationRegistry, admin, automationId } = await setupActiveAutomation();

			const newTriggerConfig = ethers.toUtf8Bytes('new_config');
			const newExecuteData = ethers.toUtf8Bytes('new_execute_data');
			const newInterval = 7200;
			await expect(
				automationRegistry.connect(admin).updateAutomation(automationId, newTriggerConfig, newExecuteData, newInterval, 600000)
			).to.emit(automationRegistry, 'AutomationUpdated');

			const config = await automationRegistry.getAutomationConfig(automationId);
			expect(ethers.hexlify(config.triggerConfig)).to.equal(ethers.hexlify(newTriggerConfig));
			expect(ethers.hexlify(config.executeData)).to.equal(ethers.hexlify(newExecuteData));
			expect(config.interval).to.equal(newInterval);
			expect(config.gasLimit).to.equal(600000);
		});

		it('Should allow deactivating an automation', async function () {
			const { automationRegistry, admin, automationId } = await setupActiveAutomation();

			await expect(automationRegistry.connect(admin).deactivateAutomation(automationId))
				.to.emit(automationRegistry, 'AutomationStatusChanged')
				.withArgs(automationId, false);

			const config = await automationRegistry.getAutomationConfig(automationId);
			expect(config.isActive).to.equal(false);
		});

		it('Should allow cancelling an automation', async function () {
			const { automationRegistry, admin, automationId, linkToken } = await setupActiveAutomation();
			const initialLinkBalance = await linkToken.balanceOf(admin.address);

			await expect(automationRegistry.connect(admin).cancelAutomation(automationId))
				.to.emit(automationRegistry, 'AutomationCancelled')
				.withArgs(automationId);
			await expect(automationRegistry.getAutomationConfig(automationId)).to.be.revertedWithCustomError(
				automationRegistry,
				'AutomationNotFound'
			);
			const finalLinkBalance = await linkToken.balanceOf(admin.address);
			expect(finalLinkBalance).to.be.gt(initialLinkBalance);
		});

		it('Should provide correct list of automation IDs', async function () {
			const { automationRegistry, linkToken, admin, mockTarget } = await loadFixture(deployAutomationRegistryFixture);
			const targetAddress = await mockTarget.getAddress();
			const registerAutomation = async (name: string, triggerType: BigNumberish) => {
				const tx = await automationRegistry
					.connect(admin)
					.registerAutomation(
						name,
						triggerType,
						triggerType === 0 ? TIME_TRIGGER_CONFIG : PRICE_TRIGGER_CONFIG,
						targetAddress,
						EXECUTE_DATA,
						0,
						TEST_INTERVAL,
						GAS_LIMIT
					);
				const receipt = await tx.wait();
				const event = receipt?.logs.find((log) => log instanceof EventLog && log.eventName === 'AutomationRegistered') as EventLog;
				return event.args[0];
			};

			const id1 = await registerAutomation('Time Automation', 0);
			const id2 = await registerAutomation('Price Automation', 1);
			const id3 = await registerAutomation('Position Health Automation', 2);
			const allIds = await automationRegistry.getAutomationIds();
			expect(allIds).to.have.lengthOf(3);
			expect(allIds).to.include(id1);
			expect(allIds).to.include(id2);
			expect(allIds).to.include(id3);
			const timeAutomations = await automationRegistry.getAutomationIdsByType(0);
			expect(timeAutomations).to.have.lengthOf(1);
			expect(timeAutomations[0]).to.equal(id1);

			const priceAutomations = await automationRegistry.getAutomationIdsByType(1);
			expect(priceAutomations).to.have.lengthOf(1);
			expect(priceAutomations[0]).to.equal(id2);
			const targetAutomations = await automationRegistry.getAutomationsForTarget(targetAddress);
			expect(targetAutomations).to.have.lengthOf(3);
		});
	});

	describe('Chainlink Integration', function () {
		it('Should implement checkUpkeep for Chainlink Automation compatibility', async function () {
			const { automationRegistry, linkToken, admin, mockTarget, chainlinkRegistry } =
				await setupActiveAutomationWithElapsedInterval();
			const automationId = await getFirstAutomationId(automationRegistry);
			const [upkeepNeeded, performData] = await automationRegistry
				.connect(admin)
				.checkUpkeep(ethers.solidityPacked(['bytes32'], [automationId]));

			expect(upkeepNeeded).to.equal(true);
			expect(performData).to.not.equal('0x');
		});

		it('Should implement performUpkeep for Chainlink Automation compatibility', async function () {
			const { automationRegistry, mockTarget, chainlinkRegistry, executor } = await setupActiveAutomationWithElapsedInterval();
			await mockTarget.setReturnValue(true);
			const automationId = await getFirstAutomationId(automationRegistry);
			const [_, performData] = await automationRegistry.checkUpkeep(ethers.solidityPacked(['bytes32'], [automationId]));
			await expect(automationRegistry.connect(executor).performUpkeep(performData)).to.emit(automationRegistry, 'UpkeepExecuted');
			expect(await mockTarget.callCount()).to.equal(1);
			const config = await automationRegistry.getAutomationConfig(automationId);
			expect(config.executionCount).to.equal(1);
			expect(config.lastExecuted).to.be.gt(0);
		});

		it('Should reject performUpkeep from unauthorized callers', async function () {
			const { automationRegistry, user } = await loadFixture(deployAutomationRegistryFixture);
			await expect(automationRegistry.connect(user).performUpkeep('0x')).to.be.revertedWithCustomError(
				automationRegistry,
				'UnauthorizedCaller'
			);
		});
		async function setupActiveAutomationWithElapsedInterval() {
			const fixture = await loadFixture(deployAutomationRegistryFixture);
			const { automationRegistry, linkToken, admin, mockTarget, chainlinkRegistry } = fixture;
			const targetAddress = await mockTarget.getAddress();
			const tx = await automationRegistry
				.connect(admin)
				.registerAutomation(TEST_AUTOMATION_NAME, 0, TIME_TRIGGER_CONFIG, targetAddress, EXECUTE_DATA, 0, 60, GAS_LIMIT);
			const receipt = await tx.wait();
			const event = receipt?.logs.find((log) => log instanceof EventLog && log.eventName === 'AutomationRegistered') as EventLog;
			const automationId = event.args[0];
			const fundAmount = ethers.parseEther('2');
			await linkToken.connect(admin).approve(await automationRegistry.getAddress(), fundAmount);
			await automationRegistry.connect(admin).fundAutomation(automationId, fundAmount);
			await automationRegistry.connect(admin).activateAutomation(automationId);
			await chainlinkRegistry.mockCallRevert(automationRegistry.interface.getFunction('performUpkeep').selector, 'Mock failure');

			return { ...fixture, automationId };
		}

		async function getFirstAutomationId(registry: any) {
			const ids = await registry.getAutomationIds();
			return ids[0];
		}
	});

	describe('System Management', function () {
		it('Should allow owner to pause and unpause', async function () {
			const { automationRegistry, owner } = await loadFixture(deployAutomationRegistryFixture);
			await automationRegistry.connect(owner).pause();
			expect(await automationRegistry.paused()).to.equal(true);
			await automationRegistry.connect(owner).unpause();
			expect(await automationRegistry.paused()).to.equal(false);
		});

		it('Should reject checkUpkeep when paused', async function () {
			const { automationRegistry, owner } = await loadFixture(deployAutomationRegistryFixture);
			await automationRegistry.connect(owner).pause();
			const [upkeepNeeded, _] = await automationRegistry.checkUpkeep('0x');
			expect(upkeepNeeded).to.equal(false);
		});

		it('Should reject performUpkeep when paused', async function () {
			const { automationRegistry, owner, executor } = await loadFixture(deployAutomationRegistryFixture);
			await automationRegistry.connect(owner).pause();
			await expect(automationRegistry.connect(executor).performUpkeep('0x')).to.be.revertedWithCustomError(
				automationRegistry,
				'SystemPaused'
			);
		});

		it('Should allow owner to update system parameters', async function () {
			const { automationRegistry, owner } = await loadFixture(deployAutomationRegistryFixture);
			const newMinimum = ethers.parseEther('0.5');
			await automationRegistry.connect(owner).updateMinimumFunding(newMinimum);
			expect(await automationRegistry.minimumAutomationFunding()).to.equal(newMinimum);
			await automationRegistry.connect(owner).updateGasOverhead(120000, 90000);
			expect(await automationRegistry.upkeepGasOverhead()).to.equal(120000);
			expect(await automationRegistry.keeperRegistryGasOverhead()).to.equal(90000);
			const [, , , user] = await ethers.getSigners();
			await automationRegistry.connect(owner).updateChainlinkRegistry(user.address);
			expect(await automationRegistry.chainlinkRegistry()).to.equal(user.address);
		});
	});
});
