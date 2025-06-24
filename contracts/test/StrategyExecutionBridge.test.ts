import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { EventLog } from 'ethers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';

describe('StrategyExecutionBridge', function () {
	const EXECUTE_PERMISSION = ethers.encodeBytes32String('EXECUTE');
	const STRATEGY_ID = ethers.id('TEST_STRATEGY');
	const DEFAULT_GAS_LIMIT = 500000;
	const SAMPLE_DATA = ethers.toUtf8Bytes('Sample execution data');
	const SAMPLE_RESPONSE = ethers.toUtf8Bytes('Sample response data');

	async function deployStrategyExecutionBridgeFixture() {
		const [owner, agent1, agent2, user] = await ethers.getSigners();
		const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
		const agentRegistry = await AgentRegistry.deploy();
		await agentRegistry.waitForDeployment();
		const StrategyRouter = await ethers.getContractFactory('StrategyRouter');
		const strategyRouter = await StrategyRouter.deploy(await agentRegistry.getAddress());
		await strategyRouter.waitForDeployment();
		const StrategyExecutionBridge = await ethers.getContractFactory('StrategyExecutionBridge');
		const strategyExecutionBridge = await StrategyExecutionBridge.deploy(
			await strategyRouter.getAddress(),
			await agentRegistry.getAddress()
		);

		await strategyExecutionBridge.waitForDeployment();
		await agentRegistry.registerAgent(agent1.address, ethers.id('TEST_AGENT'));
		await agentRegistry.updateAgentPermissions(agent1.address, [EXECUTE_PERMISSION]);

		return {
			strategyExecutionBridge,
			strategyRouter,
			agentRegistry,
			owner,
			agent1,
			agent2,
			user,
		};
	}

	describe('Deployment', function () {
		it('shouldSetTheCorrectOwner', async function () {
			const { strategyExecutionBridge, owner } = await loadFixture(deployStrategyExecutionBridgeFixture);
			expect(await strategyExecutionBridge.owner()).to.equal(owner.address);
		});

		it('shouldSetTheCorrectGasLimit', async function () {
			const { strategyExecutionBridge } = await loadFixture(deployStrategyExecutionBridgeFixture);
			expect(await strategyExecutionBridge.getExecutionGasLimit()).to.equal(DEFAULT_GAS_LIMIT);
		});

		it('shouldFailDeploymentWithZeroAddressStrategyRouter', async function () {
			const [owner] = await ethers.getSigners();
			const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
			const agentRegistry = await AgentRegistry.deploy();
			await agentRegistry.waitForDeployment();

			const StrategyExecutionBridge = await ethers.getContractFactory('StrategyExecutionBridge');
			await expect(
				StrategyExecutionBridge.deploy(ethers.ZeroAddress, await agentRegistry.getAddress())
			).to.be.revertedWithCustomError(StrategyExecutionBridge, 'ZeroAddress');
		});

		it('shouldFailDeploymentWithZeroAddressAgentRegistry', async function () {
			const [owner] = await ethers.getSigners();
			const StrategyRouter = await ethers.getContractFactory('StrategyRouter');
			const strategyRouter = await StrategyRouter.deploy(owner.address);
			await strategyRouter.waitForDeployment();

			const StrategyExecutionBridge = await ethers.getContractFactory('StrategyExecutionBridge');
			await expect(
				StrategyExecutionBridge.deploy(await strategyRouter.getAddress(), ethers.ZeroAddress)
			).to.be.revertedWithCustomError(StrategyExecutionBridge, 'ZeroAddress');
		});
	});

	describe('StrategyExecution', function () {
		it('shouldAllowAuthorizedAgentToSubmitExecutionRequest', async function () {
			const { strategyExecutionBridge, agent1 } = await loadFixture(deployStrategyExecutionBridgeFixture);

			await expect(strategyExecutionBridge.connect(agent1).executeStrategy(STRATEGY_ID, SAMPLE_DATA))
				.to.emit(strategyExecutionBridge, 'ExecutionRequested')
				.withArgs(anyValue, ethers.getAddress(agent1.address), STRATEGY_ID, SAMPLE_DATA);
			const pendingRequests = await strategyExecutionBridge.getPendingRequests();
			expect(pendingRequests.length).to.equal(1);
			const agentRequests = await strategyExecutionBridge.getAgentRequests(agent1.address);
			expect(agentRequests.length).to.equal(1);
		});

		it('shouldRejectExecutionRequestsFromUnauthorizedAccounts', async function () {
			const { strategyExecutionBridge, user } = await loadFixture(deployStrategyExecutionBridgeFixture);

			await expect(strategyExecutionBridge.connect(user).executeStrategy(STRATEGY_ID, SAMPLE_DATA)).to.be.revertedWithCustomError(
				strategyExecutionBridge,
				'Unauthorized'
			);
		});

		it('shouldRejectExecutionRequestsWithZeroStrategyId', async function () {
			const { strategyExecutionBridge, agent1 } = await loadFixture(deployStrategyExecutionBridgeFixture);

			await expect(
				strategyExecutionBridge.connect(agent1).executeStrategy(ethers.ZeroHash, SAMPLE_DATA)
			).to.be.revertedWithCustomError(strategyExecutionBridge, 'ZeroValue');
		});

		it('shouldRejectExecutionRequestsWithEmptyData', async function () {
			const { strategyExecutionBridge, agent1 } = await loadFixture(deployStrategyExecutionBridgeFixture);

			await expect(strategyExecutionBridge.connect(agent1).executeStrategy(STRATEGY_ID, '0x')).to.be.revertedWithCustomError(
				strategyExecutionBridge,
				'InvalidRequest'
			);
		});
	});

	describe('AgentResponseProcessing', function () {
		it('shouldProcessAgentResponsesForTheirOwnRequests', async function () {
			const { strategyExecutionBridge, agent1, strategyRouter } = await loadFixture(deployStrategyExecutionBridgeFixture);
			const tx = await strategyExecutionBridge.connect(agent1).executeStrategy(STRATEGY_ID, SAMPLE_DATA);
			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			const requestId = event.args[0];
			const mockStrategyRouter = await ethers.getContractFactory('MockStrategyRouter');
			const mockRouter = await mockStrategyRouter.deploy();
			await mockRouter.waitForDeployment();
			await strategyExecutionBridge.updateStrategyRouter(await mockRouter.getAddress());
			await expect(strategyExecutionBridge.connect(agent1).processAgentResponse(requestId, SAMPLE_RESPONSE))
				.to.emit(strategyExecutionBridge, 'ExecutionCompleted')
				.withArgs(requestId, true, SAMPLE_RESPONSE);
			const requestDetails = await strategyExecutionBridge.getRequestDetails(requestId);
			expect(requestDetails.executed).to.equal(true);
			expect(requestDetails.success).to.equal(true);
			expect(ethers.hexlify(requestDetails.result)).to.equal(ethers.hexlify(SAMPLE_RESPONSE));
			const pendingRequests = await strategyExecutionBridge.getPendingRequests();
			expect(pendingRequests.length).to.equal(0);
		});

		it('shouldRejectProcessingForNonExistentRequests', async function () {
			const { strategyExecutionBridge, agent1 } = await loadFixture(deployStrategyExecutionBridgeFixture);

			const nonExistentRequestId = ethers.id('non-existent');

			await expect(
				strategyExecutionBridge.connect(agent1).processAgentResponse(nonExistentRequestId, SAMPLE_RESPONSE)
			).to.be.revertedWithCustomError(strategyExecutionBridge, 'RequestNotFound');
		});

		it('shouldRejectProcessingFromDifferentAgents', async function () {
			const { strategyExecutionBridge, agent1, agent2 } = await loadFixture(deployStrategyExecutionBridgeFixture);
			const tx = await strategyExecutionBridge.connect(agent1).executeStrategy(STRATEGY_ID, SAMPLE_DATA);
			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			const requestId = event.args[0];
			await expect(
				strategyExecutionBridge.connect(agent2).processAgentResponse(requestId, SAMPLE_RESPONSE)
			).to.be.revertedWithCustomError(strategyExecutionBridge, 'Unauthorized');
		});

		it('shouldRejectProcessingAlreadyProcessedRequests', async function () {
			const { strategyExecutionBridge, agent1 } = await loadFixture(deployStrategyExecutionBridgeFixture);
			const mockStrategyRouter = await ethers.getContractFactory('MockStrategyRouter');
			const mockRouter = await mockStrategyRouter.deploy();
			await mockRouter.waitForDeployment();
			await strategyExecutionBridge.updateStrategyRouter(await mockRouter.getAddress());
			const tx = await strategyExecutionBridge.connect(agent1).executeStrategy(STRATEGY_ID, SAMPLE_DATA);
			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			const requestId = event.args[0];
			await strategyExecutionBridge.connect(agent1).processAgentResponse(requestId, SAMPLE_RESPONSE);
			await expect(
				strategyExecutionBridge.connect(agent1).processAgentResponse(requestId, SAMPLE_RESPONSE)
			).to.be.revertedWithCustomError(strategyExecutionBridge, 'RequestAlreadyProcessed');
		});
	});

	describe('ValidationAndQueryFunctions', function () {
		it('shouldValidateExecutionRequestsCorrectly', async function () {
			const { strategyExecutionBridge, agent1, user } = await loadFixture(deployStrategyExecutionBridgeFixture);
			const [valid, _] = await strategyExecutionBridge.connect(agent1).validateExecution(STRATEGY_ID, SAMPLE_DATA);
			expect(valid).to.be.true;
			const [invalidUser, _reason1] = await strategyExecutionBridge.connect(user).validateExecution(STRATEGY_ID, SAMPLE_DATA);
			expect(invalidUser).to.be.false;
			const [invalidId, _reason2] = await strategyExecutionBridge.connect(agent1).validateExecution(ethers.ZeroHash, SAMPLE_DATA);
			expect(invalidId).to.be.false;
			const [invalidData, _reason3] = await strategyExecutionBridge.connect(agent1).validateExecution(STRATEGY_ID, '0x');
			expect(invalidData).to.be.false;
		});

		it('shouldReturnCorrectRequestDetails', async function () {
			const { strategyExecutionBridge, agent1 } = await loadFixture(deployStrategyExecutionBridgeFixture);
			const tx = await strategyExecutionBridge.connect(agent1).executeStrategy(STRATEGY_ID, SAMPLE_DATA);
			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			const requestId = event.args[0];
			const details = await strategyExecutionBridge.getRequestDetails(requestId);
			expect(details.agentAddress).to.equal(agent1.address);
			expect(details.strategyId).to.equal(STRATEGY_ID);
			expect(ethers.hexlify(details.data)).to.equal(ethers.hexlify(SAMPLE_DATA));
			expect(details.executed).to.be.false;
			expect(details.success).to.be.false;
			expect(details.result).to.equal('0x');
		});

		it('shouldReturnPendingRequests', async function () {
			const { strategyExecutionBridge, agent1 } = await loadFixture(deployStrategyExecutionBridgeFixture);
			const tx1 = await strategyExecutionBridge.connect(agent1).executeStrategy(STRATEGY_ID, SAMPLE_DATA);
			const tx2 = await strategyExecutionBridge.connect(agent1).executeStrategy(STRATEGY_ID, SAMPLE_DATA);

			const receipt1 = await tx1.wait();
			const receipt2 = await tx2.wait();
			const event1 = receipt1?.logs[0] as EventLog;
			const event2 = receipt2?.logs[0] as EventLog;
			const requestId1 = event1.args[0];
			const requestId2 = event2.args[0];
			const pendingRequests = await strategyExecutionBridge.getPendingRequests();
			expect(pendingRequests.length).to.equal(2);
			expect(pendingRequests).to.include(requestId1);
			expect(pendingRequests).to.include(requestId2);
		});

		it('shouldReturnAgentRequests', async function () {
			const { strategyExecutionBridge, agent1 } = await loadFixture(deployStrategyExecutionBridgeFixture);
			const tx1 = await strategyExecutionBridge.connect(agent1).executeStrategy(STRATEGY_ID, SAMPLE_DATA);
			const tx2 = await strategyExecutionBridge.connect(agent1).executeStrategy(STRATEGY_ID, SAMPLE_DATA);

			const receipt1 = await tx1.wait();
			const receipt2 = await tx2.wait();
			const event1 = receipt1?.logs[0] as EventLog;
			const event2 = receipt2?.logs[0] as EventLog;
			const requestId1 = event1.args[0];
			const requestId2 = event2.args[0];
			const agentRequests = await strategyExecutionBridge.getAgentRequests(agent1.address);
			expect(agentRequests.length).to.equal(2);
			expect(agentRequests).to.include(requestId1);
			expect(agentRequests).to.include(requestId2);
		});
	});

	describe('Configuration', function () {
		it('shouldAllowOwnerToUpdateGasLimit', async function () {
			const { strategyExecutionBridge, owner } = await loadFixture(deployStrategyExecutionBridgeFixture);

			const newGasLimit = 750000;
			await expect(strategyExecutionBridge.connect(owner).setExecutionGasLimit(newGasLimit))
				.to.emit(strategyExecutionBridge, 'ExecutionConfigUpdated')
				.withArgs(newGasLimit);

			expect(await strategyExecutionBridge.getExecutionGasLimit()).to.equal(newGasLimit);
		});

		it('shouldRejectGasLimitUpdatesFromNonOwners', async function () {
			const { strategyExecutionBridge, agent1 } = await loadFixture(deployStrategyExecutionBridgeFixture);

			await expect(strategyExecutionBridge.connect(agent1).setExecutionGasLimit(600000)).to.be.revertedWithCustomError(
				strategyExecutionBridge,
				'OwnableUnauthorizedAccount'
			);
		});

		it('shouldRejectGasLimitBelowMinimum', async function () {
			const { strategyExecutionBridge, owner } = await loadFixture(deployStrategyExecutionBridgeFixture);

			await expect(strategyExecutionBridge.connect(owner).setExecutionGasLimit(50000)).to.be.revertedWithCustomError(
				strategyExecutionBridge,
				'InvalidGasLimit'
			);
		});

		it('shouldAllowOwnerToUpdateStrategyRouter', async function () {
			const { strategyExecutionBridge, strategyRouter, owner } = await loadFixture(deployStrategyExecutionBridgeFixture);
			const StrategyRouter = await ethers.getContractFactory('StrategyRouter');
			const newStrategyRouter = await StrategyRouter.deploy(owner.address);
			await newStrategyRouter.waitForDeployment();
			await strategyExecutionBridge.connect(owner).updateStrategyRouter(await newStrategyRouter.getAddress());
		});

		it('shouldRejectStrategyRouterUpdatesFromNonOwners', async function () {
			const { strategyExecutionBridge, agent1 } = await loadFixture(deployStrategyExecutionBridgeFixture);

			await expect(strategyExecutionBridge.connect(agent1).updateStrategyRouter(agent1.address)).to.be.revertedWithCustomError(
				strategyExecutionBridge,
				'OwnableUnauthorizedAccount'
			);
		});

		it('shouldRejectZeroAddressStrategyRouterUpdates', async function () {
			const { strategyExecutionBridge, owner } = await loadFixture(deployStrategyExecutionBridgeFixture);

			await expect(strategyExecutionBridge.connect(owner).updateStrategyRouter(ethers.ZeroAddress)).to.be.revertedWithCustomError(
				strategyExecutionBridge,
				'ZeroAddress'
			);
		});
	});
});
