import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { EventLog } from 'ethers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';

describe('StrategyAutomationManager', function () {
	const AUTOMATION_ADMIN_PERMISSION = ethers.id('AUTOMATION_ADMIN');
	const TEST_STRATEGY_ID = ethers.id('TEST_STRATEGY');
	const TEST_POSITION_ID = 123456;
	const TEST_INTERVAL = 3600;
	const TEST_THRESHOLD = 500;
	const TEST_HEALTH_THRESHOLD = 8000;
	const TEST_REBALANCE_THRESHOLD = 200;
	const EXECUTE_DATA = ethers.toUtf8Bytes('execute_data');

	async function deployStrategyAutomationManagerFixture() {
		const [owner, admin, user] = await ethers.getSigners();
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
			ethers.parseEther('1')
		);
		await automationRegistry.waitForDeployment();
		const MockStrategyExecutionBridge = await ethers.getContractFactory('MockContract');
		const strategyExecutionBridge = await MockStrategyExecutionBridge.deploy();
		await strategyExecutionBridge.waitForDeployment();

		const MockMarketDataAggregator = await ethers.getContractFactory('MockContract');
		const marketDataAggregator = await MockMarketDataAggregator.deploy();
		await marketDataAggregator.waitForDeployment();

		const MockPositionManager = await ethers.getContractFactory('MockContract');
		const positionManager = await MockPositionManager.deploy();
		await positionManager.waitForDeployment();
		const StrategyAutomationManager = await ethers.getContractFactory('StrategyAutomationManager');
		const strategyAutomationManager = await StrategyAutomationManager.deploy(
			await automationRegistry.getAddress(),
			await strategyExecutionBridge.getAddress(),
			await agentRegistry.getAddress(),
			await marketDataAggregator.getAddress(),
			await positionManager.getAddress(),
			await linkToken.getAddress()
		);
		await strategyAutomationManager.waitForDeployment();

		const managerAddress = await strategyAutomationManager.getAddress();

		await agentRegistry.connect(owner).registerAgent(managerAddress, ethers.id('AUTOMATION_MANAGER'));
		await agentRegistry.connect(owner).updateAgentPermissions(managerAddress, [AUTOMATION_ADMIN_PERMISSION]);
		await agentRegistry.connect(owner).registerAgent(admin.address, ethers.id('ADMIN_AGENT'));
		await agentRegistry.connect(owner).updateAgentPermissions(admin.address, [AUTOMATION_ADMIN_PERMISSION]);

		return {
			strategyAutomationManager,
			automationRegistry,
			agentRegistry,
			linkToken,
			chainlinkRegistry,
			strategyExecutionBridge,
			marketDataAggregator,
			positionManager,
			owner,
			admin,
			user,
		};
	}

	describe('Deployment', function () {
		it('shouldSetTheCorrectOwner', async function () {
			const { strategyAutomationManager, owner } = await loadFixture(deployStrategyAutomationManagerFixture);
			expect(await strategyAutomationManager.owner()).to.equal(owner.address);
		});

		it('shouldInitializeWithCorrectDependencies', async function () {
			const {
				strategyAutomationManager,
				automationRegistry,
				agentRegistry,
				strategyExecutionBridge,
				marketDataAggregator,
				positionManager,
				linkToken,
			} = await loadFixture(deployStrategyAutomationManagerFixture);

			expect(await strategyAutomationManager.automationRegistry()).to.equal(await automationRegistry.getAddress());
			expect(await strategyAutomationManager.agentRegistry()).to.equal(await agentRegistry.getAddress());
			expect(await strategyAutomationManager.strategyExecutionBridge()).to.equal(await strategyExecutionBridge.getAddress());
			expect(await strategyAutomationManager.marketDataAggregator()).to.equal(await marketDataAggregator.getAddress());
			expect(await strategyAutomationManager.positionManager()).to.equal(await positionManager.getAddress());
			expect(await strategyAutomationManager.linkToken()).to.equal(await linkToken.getAddress());
		});

		it('shouldFailDeploymentWithZeroAddressDependencies', async function () {
			const { automationRegistry, strategyExecutionBridge, agentRegistry, marketDataAggregator, positionManager, linkToken } =
				await loadFixture(deployStrategyAutomationManagerFixture);

			const StrategyAutomationManager = await ethers.getContractFactory('StrategyAutomationManager');
			await expect(
				StrategyAutomationManager.deploy(
					ethers.ZeroAddress,
					await strategyExecutionBridge.getAddress(),
					await agentRegistry.getAddress(),
					await marketDataAggregator.getAddress(),
					await positionManager.getAddress(),
					await linkToken.getAddress()
				)
			).to.be.revertedWithCustomError(StrategyAutomationManager, 'ZeroAddress');

			await expect(
				StrategyAutomationManager.deploy(
					await automationRegistry.getAddress(),
					ethers.ZeroAddress,
					await agentRegistry.getAddress(),
					await marketDataAggregator.getAddress(),
					await positionManager.getAddress(),
					await linkToken.getAddress()
				)
			).to.be.revertedWithCustomError(StrategyAutomationManager, 'ZeroAddress');

			await expect(
				StrategyAutomationManager.deploy(
					await automationRegistry.getAddress(),
					await strategyExecutionBridge.getAddress(),
					ethers.ZeroAddress,
					await marketDataAggregator.getAddress(),
					await positionManager.getAddress(),
					await linkToken.getAddress()
				)
			).to.be.revertedWithCustomError(StrategyAutomationManager, 'ZeroAddress');
		});
	});

	describe('StrategyTimeBasedAutomation', function () {
		it('shouldCreateTimeBasedStrategyAutomation', async function () {
			const { strategyAutomationManager, automationRegistry, linkToken, agentRegistry, admin } = await loadFixture(
				deployStrategyAutomationManagerFixture
			);

			const linkAmount = ethers.parseEther('2');
			await linkToken.connect(admin).approve(await strategyAutomationManager.getAddress(), linkAmount);

			const tx = await strategyAutomationManager
				.connect(admin)
				.createStrategyTimeAutomation(TEST_STRATEGY_ID, TEST_INTERVAL, EXECUTE_DATA, linkAmount);

			const receipt = await tx.wait();
			const event = receipt?.logs.find(
				(log) => log instanceof EventLog && log.eventName === 'StrategyAutomationCreated'
			) as EventLog;

			expect(event).to.not.be.undefined;
			expect(event.args[0]).to.equal(TEST_STRATEGY_ID);
			const automationId = await strategyAutomationManager.getStrategyAutomationId(TEST_STRATEGY_ID);
			expect(automationId).to.not.equal(ethers.ZeroHash);
			const config = await strategyAutomationManager.getStrategyAutomationConfig(TEST_STRATEGY_ID);
			expect(config.strategyId).to.equal(TEST_STRATEGY_ID);
			expect(config.interval).to.equal(TEST_INTERVAL);
			expect(config.isActive).to.equal(true);
		});

		it('shouldPreventUnauthorizedUsersFromCreatingStrategyAutomation', async function () {
			const { strategyAutomationManager, user } = await loadFixture(deployStrategyAutomationManagerFixture);

			await expect(
				strategyAutomationManager.connect(user).createStrategyTimeAutomation(TEST_STRATEGY_ID, TEST_INTERVAL, EXECUTE_DATA, 0)
			).to.be.revertedWithCustomError(strategyAutomationManager, 'UnauthorizedCaller');
		});

		it('shouldRejectTimeBasedAutomationWithInvalidInterval', async function () {
			const { strategyAutomationManager, admin } = await loadFixture(deployStrategyAutomationManagerFixture);

			await expect(
				strategyAutomationManager.connect(admin).createStrategyTimeAutomation(TEST_STRATEGY_ID, 60, EXECUTE_DATA, 0)
			).to.be.revertedWithCustomError(strategyAutomationManager, 'InvalidInterval');
		});
	});

	describe('StrategyPriceBasedAutomation', function () {
		it('shouldCreatePriceDeviationStrategyAutomation', async function () {
			const { strategyAutomationManager, linkToken, admin } = await loadFixture(deployStrategyAutomationManagerFixture);

			const linkAmount = ethers.parseEther('2');
			await linkToken.connect(admin).approve(await strategyAutomationManager.getAddress(), linkAmount);

			const tokenAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
			const tx = await strategyAutomationManager
				.connect(admin)
				.createStrategyPriceAutomation(TEST_STRATEGY_ID, tokenAddress, TEST_THRESHOLD, TEST_INTERVAL, EXECUTE_DATA, linkAmount);

			const receipt = await tx.wait();
			const event = receipt?.logs.find(
				(log) => log instanceof EventLog && log.eventName === 'StrategyAutomationCreated'
			) as EventLog;

			expect(event).to.not.be.undefined;
			expect(event.args[0]).to.equal(TEST_STRATEGY_ID);
			expect(event.args[2]).to.equal(TEST_THRESHOLD);
			const automationId = await strategyAutomationManager.getStrategyAutomationId(TEST_STRATEGY_ID);
			expect(automationId).to.not.equal(ethers.ZeroHash);
			const config = await strategyAutomationManager.getStrategyAutomationConfig(TEST_STRATEGY_ID);
			expect(config.strategyId).to.equal(TEST_STRATEGY_ID);
			expect(config.threshold).to.equal(TEST_THRESHOLD);
			expect(config.interval).to.equal(TEST_INTERVAL);
			expect(config.isActive).to.equal(true);
		});

		it('shouldRejectPriceAutomationWithInvalidThreshold', async function () {
			const { strategyAutomationManager, admin } = await loadFixture(deployStrategyAutomationManagerFixture);

			const tokenAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
			await expect(
				strategyAutomationManager
					.connect(admin)
					.createStrategyPriceAutomation(TEST_STRATEGY_ID, tokenAddress, 50, TEST_INTERVAL, EXECUTE_DATA, 0)
			).to.be.revertedWithCustomError(strategyAutomationManager, 'InvalidThreshold');
		});
	});

	describe('PositionHealthAutomation', function () {
		it('shouldCreatePositionHealthMonitoringAutomation', async function () {
			const { strategyAutomationManager, linkToken, admin } = await loadFixture(deployStrategyAutomationManagerFixture);

			const linkAmount = ethers.parseEther('2');
			await linkToken.connect(admin).approve(await strategyAutomationManager.getAddress(), linkAmount);

			const tx = await strategyAutomationManager
				.connect(admin)
				.createPositionHealthAutomation(
					TEST_POSITION_ID,
					TEST_HEALTH_THRESHOLD,
					TEST_REBALANCE_THRESHOLD,
					TEST_INTERVAL,
					linkAmount
				);

			const receipt = await tx.wait();
			const event = receipt?.logs.find(
				(log) => log instanceof EventLog && log.eventName === 'PositionAutomationCreated'
			) as EventLog;

			expect(event).to.not.be.undefined;
			expect(event.args[0]).to.equal(TEST_POSITION_ID);
			expect(event.args[2]).to.equal(TEST_HEALTH_THRESHOLD);
			expect(event.args[3]).to.equal(TEST_REBALANCE_THRESHOLD);
			const automationId = await strategyAutomationManager.getPositionAutomationId(TEST_POSITION_ID);
			expect(automationId).to.not.equal(ethers.ZeroHash);
			const config = await strategyAutomationManager.getPositionAutomationConfig(TEST_POSITION_ID);
			expect(config.positionId).to.equal(TEST_POSITION_ID);
			expect(config.healthThreshold).to.equal(TEST_HEALTH_THRESHOLD);
			expect(config.rebalanceThreshold).to.equal(TEST_REBALANCE_THRESHOLD);
			expect(config.interval).to.equal(TEST_INTERVAL);
			expect(config.isActive).to.equal(true);
		});

		it('shouldRejectPositionAutomationWithInvalidHealthThreshold', async function () {
			const { strategyAutomationManager, admin } = await loadFixture(deployStrategyAutomationManagerFixture);

			await expect(
				strategyAutomationManager
					.connect(admin)
					.createPositionHealthAutomation(TEST_POSITION_ID, 300, TEST_REBALANCE_THRESHOLD, TEST_INTERVAL, 0)
			).to.be.revertedWithCustomError(strategyAutomationManager, 'InvalidThreshold');
		});

		it('shouldRejectPositionAutomationWithInvalidRebalanceThreshold', async function () {
			const { strategyAutomationManager, admin } = await loadFixture(deployStrategyAutomationManagerFixture);

			await expect(
				strategyAutomationManager
					.connect(admin)
					.createPositionHealthAutomation(TEST_POSITION_ID, TEST_HEALTH_THRESHOLD, 1500, TEST_INTERVAL, 0)
			).to.be.revertedWithCustomError(strategyAutomationManager, 'InvalidThreshold');
		});
	});

	describe('AutomationManagement', function () {
		async function setupStrategyAutomation() {
			const fixture = await loadFixture(deployStrategyAutomationManagerFixture);
			const { strategyAutomationManager, linkToken, admin } = fixture;

			const linkAmount = ethers.parseEther('2');
			await linkToken.connect(admin).approve(await strategyAutomationManager.getAddress(), linkAmount);

			await strategyAutomationManager
				.connect(admin)
				.createStrategyTimeAutomation(TEST_STRATEGY_ID, TEST_INTERVAL, EXECUTE_DATA, linkAmount);

			return fixture;
		}

		async function setupPositionAutomation() {
			const fixture = await loadFixture(deployStrategyAutomationManagerFixture);
			const { strategyAutomationManager, linkToken, admin } = fixture;

			const linkAmount = ethers.parseEther('2');
			await linkToken.connect(admin).approve(await strategyAutomationManager.getAddress(), linkAmount);

			await strategyAutomationManager
				.connect(admin)
				.createPositionHealthAutomation(
					TEST_POSITION_ID,
					TEST_HEALTH_THRESHOLD,
					TEST_REBALANCE_THRESHOLD,
					TEST_INTERVAL,
					linkAmount
				);

			return fixture;
		}

		it('shouldUpdateStrategyAutomationConfiguration', async function () {
			const { strategyAutomationManager, admin } = await setupStrategyAutomation();

			const newThreshold = 1000;
			const newInterval = 7200;
			await expect(
				strategyAutomationManager.connect(admin).updateStrategyAutomation(TEST_STRATEGY_ID, newThreshold, newInterval, true)
			).to.emit(strategyAutomationManager, 'StrategyAutomationUpdated');

			const config = await strategyAutomationManager.getStrategyAutomationConfig(TEST_STRATEGY_ID);
			expect(config.threshold).to.equal(newThreshold);
			expect(config.interval).to.equal(newInterval);
			expect(config.isActive).to.equal(true);
		});

		it('shouldUpdatePositionAutomationConfiguration', async function () {
			const { strategyAutomationManager, admin } = await setupPositionAutomation();

			const newHealthThreshold = 7000;
			const newRebalanceThreshold = 300;
			const newInterval = 7200;
			await expect(
				strategyAutomationManager
					.connect(admin)
					.updatePositionAutomation(TEST_POSITION_ID, newHealthThreshold, newRebalanceThreshold, newInterval, true)
			).to.emit(strategyAutomationManager, 'PositionAutomationUpdated');

			const config = await strategyAutomationManager.getPositionAutomationConfig(TEST_POSITION_ID);
			expect(config.healthThreshold).to.equal(newHealthThreshold);
			expect(config.rebalanceThreshold).to.equal(newRebalanceThreshold);
			expect(config.interval).to.equal(newInterval);
			expect(config.isActive).to.equal(true);
		});

		it('shouldCancelStrategyAutomation', async function () {
			const { strategyAutomationManager, admin } = await setupStrategyAutomation();

			await expect(strategyAutomationManager.connect(admin).cancelStrategyAutomation(TEST_STRATEGY_ID)).to.be.not.reverted;
			await expect(strategyAutomationManager.getStrategyAutomationId(TEST_STRATEGY_ID)).to.be.revertedWithCustomError(
				strategyAutomationManager,
				'AutomationNotFound'
			);
		});

		it('shouldCancelPositionAutomation', async function () {
			const { strategyAutomationManager, admin } = await setupPositionAutomation();

			await expect(strategyAutomationManager.connect(admin).cancelPositionAutomation(TEST_POSITION_ID)).to.be.not.reverted;
			await expect(strategyAutomationManager.getPositionAutomationId(TEST_POSITION_ID)).to.be.revertedWithCustomError(
				strategyAutomationManager,
				'AutomationNotFound'
			);
		});
	});

	describe('PositionMonitoring', function () {
		it('shouldCheckAndRebalancePositionFromAutomationRegistry', async function () {
			const fixture = await setupPositionAutomationFixture();
			const { strategyAutomationManager, automationRegistry, admin, positionManager } = fixture;
			const automationId = await strategyAutomationManager.getPositionAutomationId(TEST_POSITION_ID);
			await expect(strategyAutomationManager.connect(admin).checkAndRebalancePosition(TEST_POSITION_ID))
				.to.emit(strategyAutomationManager, 'PositionAutomationTriggered')
				.withArgs(TEST_POSITION_ID, automationId);
		});

		it('shouldRejectPositionCheckFromUnauthorizedCaller', async function () {
			const { strategyAutomationManager, user } = await setupPositionAutomationFixture();

			await expect(
				strategyAutomationManager.connect(user).checkAndRebalancePosition(TEST_POSITION_ID)
			).to.be.revertedWithCustomError(strategyAutomationManager, 'UnauthorizedCaller');
		});

		async function setupPositionAutomationFixture() {
			const fixture = await loadFixture(deployStrategyAutomationManagerFixture);
			const { strategyAutomationManager, linkToken, admin } = fixture;

			const linkAmount = ethers.parseEther('2');
			await linkToken.connect(admin).approve(await strategyAutomationManager.getAddress(), linkAmount);

			await strategyAutomationManager
				.connect(admin)
				.createPositionHealthAutomation(
					TEST_POSITION_ID,
					TEST_HEALTH_THRESHOLD,
					TEST_REBALANCE_THRESHOLD,
					TEST_INTERVAL,
					linkAmount
				);

			return fixture;
		}
	});

	describe('AdditionalFunding', function () {
		it('shouldAddFundingToExistingAutomation', async function () {
			const { strategyAutomationManager, automationRegistry, linkToken, admin } = await setupStrategyAutomation();

			const automationId = await strategyAutomationManager.getStrategyAutomationId(TEST_STRATEGY_ID);
			const initialBalance = await automationRegistry.getAutomationBalance(automationId);
			const additionalFunding = ethers.parseEther('1');
			await linkToken.connect(admin).approve(await strategyAutomationManager.getAddress(), additionalFunding);

			await expect(strategyAutomationManager.connect(admin).addFunding(automationId, additionalFunding)).to.not.be.reverted;
			const newBalance = await automationRegistry.getAutomationBalance(automationId);
			expect(newBalance).to.be.gt(initialBalance);
		});

		async function setupStrategyAutomation() {
			const fixture = await loadFixture(deployStrategyAutomationManagerFixture);
			const { strategyAutomationManager, linkToken, admin } = fixture;

			const linkAmount = ethers.parseEther('2');
			await linkToken.connect(admin).approve(await strategyAutomationManager.getAddress(), linkAmount);

			await strategyAutomationManager
				.connect(admin)
				.createStrategyTimeAutomation(TEST_STRATEGY_ID, TEST_INTERVAL, EXECUTE_DATA, linkAmount);

			return fixture;
		}
	});

	describe('SystemManagement', function () {
		it('shouldUpdateSystemComponentAddresses', async function () {
			const { strategyAutomationManager, owner } = await loadFixture(deployStrategyAutomationManagerFixture);
			const MockContract = await ethers.getContractFactory('MockContract');
			const newComponent = await MockContract.deploy();
			await newComponent.waitForDeployment();
			const newAddress = await newComponent.getAddress();
			await expect(strategyAutomationManager.connect(owner).updateAutomationRegistry(newAddress))
				.to.emit(strategyAutomationManager, 'SystemComponentUpdated')
				.withArgs('AutomationRegistry', anyValue, newAddress);

			expect(await strategyAutomationManager.automationRegistry()).to.equal(newAddress);
			await expect(strategyAutomationManager.connect(owner).updateStrategyExecutionBridge(newAddress))
				.to.emit(strategyAutomationManager, 'SystemComponentUpdated')
				.withArgs('StrategyExecutionBridge', anyValue, newAddress);

			expect(await strategyAutomationManager.strategyExecutionBridge()).to.equal(newAddress);
			await expect(strategyAutomationManager.connect(owner).updateAgentRegistry(newAddress))
				.to.emit(strategyAutomationManager, 'SystemComponentUpdated')
				.withArgs('AgentRegistry', anyValue, newAddress);

			expect(await strategyAutomationManager.agentRegistry()).to.equal(newAddress);
			await expect(strategyAutomationManager.connect(owner).updateMarketDataAggregator(newAddress))
				.to.emit(strategyAutomationManager, 'SystemComponentUpdated')
				.withArgs('MarketDataAggregator', anyValue, newAddress);

			expect(await strategyAutomationManager.marketDataAggregator()).to.equal(newAddress);
			await expect(strategyAutomationManager.connect(owner).updatePositionManager(newAddress))
				.to.emit(strategyAutomationManager, 'SystemComponentUpdated')
				.withArgs('PositionManager', anyValue, newAddress);

			expect(await strategyAutomationManager.positionManager()).to.equal(newAddress);
		});

		it('shouldRejectUpdatingToZeroAddressComponents', async function () {
			const { strategyAutomationManager, owner } = await loadFixture(deployStrategyAutomationManagerFixture);

			await expect(
				strategyAutomationManager.connect(owner).updateAutomationRegistry(ethers.ZeroAddress)
			).to.be.revertedWithCustomError(strategyAutomationManager, 'ZeroAddress');

			await expect(
				strategyAutomationManager.connect(owner).updateStrategyExecutionBridge(ethers.ZeroAddress)
			).to.be.revertedWithCustomError(strategyAutomationManager, 'ZeroAddress');
		});
	});
});
