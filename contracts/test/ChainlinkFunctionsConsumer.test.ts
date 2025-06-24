import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { EventLog } from 'ethers';

describe('ChainlinkFunctionsConsumer', function () {
	const SUBSCRIPTION_ID = 1n;
	const DON_ID = ethers.id('fun-sepolia-1');
	const EXECUTE_PERMISSION = ethers.id('EXECUTE');
	const AGENT_TYPE = ethers.id('YIELD');
	const DEFAULT_GAS_LIMIT = 100000;

	async function deployChainlinkFunctionsConsumerFixture() {
		const [owner, agent1, agent2, user1, user2] = await ethers.getSigners();
		
    const AccessController = await ethers.getContractFactory('AccessController');
		const accessController = await AccessController.deploy(owner.address);
		await accessController.waitForDeployment();

		const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
		const agentRegistry = await AgentRegistry.deploy();
		await agentRegistry.waitForDeployment();
		
    const StrategyRouter = await ethers.getContractFactory('StrategyRouter');
		const strategyRouter = await StrategyRouter.deploy(await agentRegistry.getAddress());
		await strategyRouter.waitForDeployment();
		
    const MockFunctionsRouter = await ethers.getContractFactory('MockFunctionsRouter');
		const mockFunctionsRouter = await MockFunctionsRouter.deploy();
		await mockFunctionsRouter.waitForDeployment();
		
    const ChainlinkFunctionsConsumer = await ethers.getContractFactory('ChainlinkFunctionsConsumer');
		const functionsConsumer = await ChainlinkFunctionsConsumer.deploy(
			await mockFunctionsRouter.getAddress(),
			await strategyRouter.getAddress(),
			await agentRegistry.getAddress(),
			SUBSCRIPTION_ID,
			DON_ID
		);
		await functionsConsumer.waitForDeployment();
		
    await agentRegistry.registerAgent(agent1.address, AGENT_TYPE);
		await agentRegistry.registerAgent(agent2.address, AGENT_TYPE);
		await agentRegistry.updateAgentPermissions(agent1.address, [EXECUTE_PERMISSION]);
		await agentRegistry.updateAgentPermissions(agent2.address, [EXECUTE_PERMISSION]);
		
    const jsSource = `
      const agentAddress = args[0];
      const requestData = args[1];
      const strategyId = Functions.encodeString("test-strategy");
      const actionData = Functions.encodeString("test-action");
      
      return Functions.encodeBytes32([strategyId, actionData]);
    `;
		await functionsConsumer.updateJavaScriptSource(jsSource);

		return {
			functionsConsumer,
			strategyRouter,
			agentRegistry,
			accessController,
			mockFunctionsRouter,
			owner,
			agent1,
			agent2,
			user1,
			user2,
		};
	}

	describe('Deployment', function () {
		it('Should set the correct owner', async function () {
			const { functionsConsumer, owner } = await loadFixture(deployChainlinkFunctionsConsumerFixture);
			expect(await functionsConsumer.owner()).to.equal(owner.address);
		});

		it('Should set the correct subscription ID and DON ID', async function () {
			const { functionsConsumer } = await loadFixture(deployChainlinkFunctionsConsumerFixture);
			const [subscriptionId, donId] = await functionsConsumer.getSubscriptionInfo();
			expect(subscriptionId).to.equal(SUBSCRIPTION_ID);
			expect(donId).to.equal(DON_ID);
		});

		it('Should fail with zero address router', async function () {
			const [owner] = await ethers.getSigners();
			const AccessController = await ethers.getContractFactory('AccessController');
			const accessController = await AccessController.deploy(owner.address);

			const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
			const agentRegistry = await AgentRegistry.deploy();

			const StrategyRouter = await ethers.getContractFactory('StrategyRouter');
			const strategyRouter = await StrategyRouter.deploy(await agentRegistry.getAddress());

			const ChainlinkFunctionsConsumer = await ethers.getContractFactory('ChainlinkFunctionsConsumer');
			await expect(
				ChainlinkFunctionsConsumer.deploy(
					ethers.ZeroAddress,
					await strategyRouter.getAddress(),
					await agentRegistry.getAddress(),
					SUBSCRIPTION_ID,
					DON_ID
				)
			).to.be.revertedWithCustomError(ChainlinkFunctionsConsumer, 'ZeroAddress');
		});

		it('Should fail with zero subscription ID', async function () {
			const { strategyRouter, agentRegistry, mockFunctionsRouter } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const ChainlinkFunctionsConsumer = await ethers.getContractFactory('ChainlinkFunctionsConsumer');
			await expect(
				ChainlinkFunctionsConsumer.deploy(
					await mockFunctionsRouter.getAddress(),
					await strategyRouter.getAddress(),
					await agentRegistry.getAddress(),
					0,
					DON_ID
				)
			).to.be.revertedWithCustomError(ChainlinkFunctionsConsumer, 'InvalidSubscriptionId');
		});

		it('Should fail with zero DON ID', async function () {
			const { strategyRouter, agentRegistry, mockFunctionsRouter } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const ChainlinkFunctionsConsumer = await ethers.getContractFactory('ChainlinkFunctionsConsumer');
			await expect(
				ChainlinkFunctionsConsumer.deploy(
					await mockFunctionsRouter.getAddress(),
					await strategyRouter.getAddress(),
					await agentRegistry.getAddress(),
					SUBSCRIPTION_ID,
					ethers.ZeroHash
				)
			).to.be.revertedWithCustomError(ChainlinkFunctionsConsumer, 'InvalidDONId');
		});
	});

	describe('Request Management', function () {
		it('Should submit agent request successfully', async function () {
			const { functionsConsumer, agent1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const requestData = ethers.toUtf8Bytes('test request data');

			await expect(functionsConsumer.connect(agent1).submitAgentRequest(agent1.address, requestData, DEFAULT_GAS_LIMIT)).to.emit(
				functionsConsumer,
				'AgentRequestSubmitted'
			);
		});

		it('Should fail with empty agent ID', async function () {
			const { functionsConsumer, agent1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const requestData = ethers.toUtf8Bytes('test request data');

			await expect(
				functionsConsumer.connect(agent1).submitAgentRequest(ethers.ZeroAddress, requestData, DEFAULT_GAS_LIMIT)
			).to.be.revertedWithCustomError(functionsConsumer, 'ZeroAddress');
		});

		it('Should fail with empty request data', async function () {
			const { functionsConsumer, agent1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			await expect(
				functionsConsumer.connect(agent1).submitAgentRequest(agent1.address, '0x', DEFAULT_GAS_LIMIT)
			).to.be.revertedWithCustomError(functionsConsumer, 'AgentResponseValidationFailed');
		});

		it('Should fail with invalid gas limit', async function () {
			const { functionsConsumer, agent1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const requestData = ethers.toUtf8Bytes('test request data');

			await expect(
				functionsConsumer.connect(agent1).submitAgentRequest(agent1.address, requestData, 10000)
			).to.be.revertedWithCustomError(functionsConsumer, 'InvalidGasLimit');
		});

		it('Should fail with unauthorized requester', async function () {
			const { functionsConsumer, user1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const requestData = ethers.toUtf8Bytes('test request data');

			await expect(
				functionsConsumer.connect(user1).submitAgentRequest(user1.address, requestData, DEFAULT_GAS_LIMIT)
			).to.be.revertedWithCustomError(functionsConsumer, 'UnauthorizedRequester');
		});

		it('Should cancel request successfully', async function () {
			const { functionsConsumer, agent1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const requestData = ethers.toUtf8Bytes('test request data');
			const tx = await functionsConsumer.connect(agent1).submitAgentRequest(agent1.address, requestData, DEFAULT_GAS_LIMIT);
			const receipt = await tx.wait();
			const event = receipt?.logs.find((log) => log instanceof EventLog && log.fragment?.name === 'AgentRequestSubmitted') as EventLog;
			const requestId = event.args[0];
			await expect(functionsConsumer.connect(agent1).cancelRequest(requestId)).to.emit(functionsConsumer, 'RequestCancelled');
		});

		it('Should get request status correctly', async function () {
			const { functionsConsumer, agent1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const requestData = ethers.toUtf8Bytes('test request data');
			const tx = await functionsConsumer.connect(agent1).submitAgentRequest(agent1.address, requestData, DEFAULT_GAS_LIMIT);
			const receipt = await tx.wait();
			const event = receipt?.logs.find((log) => log instanceof EventLog && log.fragment?.name === 'AgentRequestSubmitted') as EventLog;
			const requestId = event.args[0];
			const status = await functionsConsumer.getRequestStatus(requestId);
			expect(status).to.equal(0);
		});

		it('Should get requests by requester', async function () {
			const { functionsConsumer, agent1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const requestData = ethers.toUtf8Bytes('test request data');
			await functionsConsumer.connect(agent1).submitAgentRequest(agent1.address, requestData, DEFAULT_GAS_LIMIT);
			const requests = await functionsConsumer.getRequestsByRequester(agent1.address);
			expect(requests.length).to.equal(1);
		});

		it('Should get active requests count', async function () {
			const { functionsConsumer, agent1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const requestData = ethers.toUtf8Bytes('test request data');
			expect(await functionsConsumer.getActiveRequestsCount()).to.equal(0);
			await functionsConsumer.connect(agent1).submitAgentRequest(agent1.address, requestData, DEFAULT_GAS_LIMIT);
			expect(await functionsConsumer.getActiveRequestsCount()).to.equal(1);
		});
	});

	describe('Configuration Management', function () {
		it('Should update subscription ID', async function () {
			const { functionsConsumer, owner } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const newSubscriptionId = 2n;

			await expect(functionsConsumer.connect(owner).updateSubscriptionId(newSubscriptionId))
				.to.emit(functionsConsumer, 'ConfigurationUpdated')
				.withArgs('subscriptionId', newSubscriptionId);

			const [subscriptionId] = await functionsConsumer.getSubscriptionInfo();
			expect(subscriptionId).to.equal(newSubscriptionId);
		});

		it('Should update gas limits', async function () {
			const { functionsConsumer, owner } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const newCallbackGasLimit = 150000;
			const newRequestGasLimit = 400000;

			await expect(functionsConsumer.connect(owner).updateGasLimits(newCallbackGasLimit, newRequestGasLimit)).to.emit(
				functionsConsumer,
				'ConfigurationUpdated'
			);

			const [callbackGasLimit, requestGasLimit] = await functionsConsumer.getGasConfiguration();
			expect(callbackGasLimit).to.equal(newCallbackGasLimit);
			expect(requestGasLimit).to.equal(newRequestGasLimit);
		});

		it('Should update DON hosted secrets version', async function () {
			const { functionsConsumer, owner } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const newVersion = 2n;

			await expect(functionsConsumer.connect(owner).setDONHostedSecretsVersion(newVersion))
				.to.emit(functionsConsumer, 'ConfigurationUpdated')
				.withArgs('donHostedSecretsVersion', newVersion);
		});

		it('Should update JavaScript source', async function () {
			const { functionsConsumer, owner } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const newSource = "console.log('updated source');";

			await expect(functionsConsumer.connect(owner).updateJavaScriptSource(newSource)).to.emit(
				functionsConsumer,
				'ConfigurationUpdated'
			);
		});

		it('Should fail to update with empty JavaScript source', async function () {
			const { functionsConsumer, owner } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			await expect(functionsConsumer.connect(owner).updateJavaScriptSource('')).to.be.revertedWithCustomError(
				functionsConsumer,
				'EmptyJavaScriptSource'
			);
		});

		it('Should update strategy router', async function () {
			const { functionsConsumer, owner, agentRegistry } = await loadFixture(deployChainlinkFunctionsConsumerFixture);
			const StrategyRouter = await ethers.getContractFactory('StrategyRouter');
			const newStrategyRouter = await StrategyRouter.deploy(await agentRegistry.getAddress());
			await newStrategyRouter.waitForDeployment();

			await expect(functionsConsumer.connect(owner).updateStrategyRouter(await newStrategyRouter.getAddress())).to.emit(
				functionsConsumer,
				'StrategyRouterUpdated'
			);
		});

		it('Should update agent registry', async function () {
			const { functionsConsumer, owner, accessController } = await loadFixture(deployChainlinkFunctionsConsumerFixture);
			const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
			const newAgentRegistry = await AgentRegistry.deploy();
			await newAgentRegistry.waitForDeployment();

			await expect(functionsConsumer.connect(owner).updateAgentRegistry(await newAgentRegistry.getAddress())).to.emit(
				functionsConsumer,
				'AgentRegistryUpdated'
			);
		});

		it('Should only allow owner to update configuration', async function () {
			const { functionsConsumer, user1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			await expect(functionsConsumer.connect(user1).updateSubscriptionId(2n)).to.be.revertedWithCustomError(
				functionsConsumer,
				'OwnableUnauthorizedAccount'
			);
		});
	});

	describe('Access Control', function () {
		it('Should prevent unauthorized access to internal functions', async function () {
			const { functionsConsumer, user1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const strategyId = ethers.id('test-strategy');
			const actionData = ethers.toUtf8Bytes('test action');

			await expect(functionsConsumer.connect(user1).executeStrategyFromAgent(strategyId, actionData)).to.be.revertedWithCustomError(
				functionsConsumer,
				'UnauthorizedRequester'
			);
		});

		it('Should prevent unauthorized access to batch execution', async function () {
			const { functionsConsumer, user1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const strategyIds = [ethers.id('test-strategy')];
			const actionData = [ethers.toUtf8Bytes('test action')];

			await expect(functionsConsumer.connect(user1).batchExecuteFromAgent(strategyIds, actionData)).to.be.revertedWithCustomError(
				functionsConsumer,
				'UnauthorizedRequester'
			);
		});
	});

	describe('Edge Cases', function () {
		it('Should handle request with zero gas limit', async function () {
			const { functionsConsumer, agent1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const requestData = ethers.toUtf8Bytes('test request data');

			await expect(
				functionsConsumer.connect(agent1).submitAgentRequest(agent1.address, requestData, 0)
			).to.be.revertedWithCustomError(functionsConsumer, 'InvalidGasLimit');
		});

		it('Should handle request with maximum gas limit', async function () {
			const { functionsConsumer, agent1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const agentId = ethers.encodeBytes32String('agent1');
			const requestData = ethers.toUtf8Bytes('test request data');

			await expect(functionsConsumer.connect(agent1).submitAgentRequest(agent1.address, requestData, 2500000)).to.emit(
				functionsConsumer,
				'AgentRequestSubmitted'
			);
		});

		it('Should handle request with gas limit exceeding maximum', async function () {
			const { functionsConsumer, agent1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const requestData = ethers.toUtf8Bytes('test request data');

			await expect(
				functionsConsumer.connect(agent1).submitAgentRequest(agent1.address, requestData, 3000000)
			).to.be.revertedWithCustomError(functionsConsumer, 'InvalidGasLimit');
		});

		it('Should fail to get status for non-existent request', async function () {
			const { functionsConsumer } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const fakeRequestId = ethers.id('fake-request');

			await expect(functionsConsumer.getRequestStatus(fakeRequestId)).to.be.revertedWithCustomError(
				functionsConsumer,
				'RequestNotFound'
			);
		});

		it('Should fail to cancel non-existent request', async function () {
			const { functionsConsumer, agent1 } = await loadFixture(deployChainlinkFunctionsConsumerFixture);

			const fakeRequestId = ethers.id('fake-request');

			await expect(functionsConsumer.connect(agent1).cancelRequest(fakeRequestId)).to.be.revertedWithCustomError(
				functionsConsumer,
				'RequestNotFound'
			);
		});
	});
});
