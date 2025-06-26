import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { EventLog } from 'ethers';

describe('AgentRequestHandler', function () {
	const SUBMIT_REQUEST_PERMISSION = ethers.keccak256(ethers.toUtf8Bytes('SUBMIT_REQUEST'));
	const PROCESS_REQUEST_PERMISSION = ethers.keccak256(ethers.toUtf8Bytes('PROCESS_REQUEST'));
	const AGENT_TYPE = ethers.id('TEST_AGENT');
	const DEFAULT_GLOBAL_LIMIT = 1000n;
	const DEFAULT_COOLDOWN_PERIOD = 60n;
	const SAMPLE_DATA = ethers.toUtf8Bytes('Sample request data');

	enum RequestPriority {
		Low,
		Medium,
		High,
		Critical,
	}
	enum RequestStatus {
		Pending,
		Processing,
		Completed,
		Failed,
		Cancelled,
	}

	async function deployAgentRequestHandlerFixture() {
		const [owner, agent1, agent2, requester1, requester2] = await ethers.getSigners();

		const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
		const agentRegistry = await AgentRegistry.deploy();
		await agentRegistry.waitForDeployment();

		const AgentRequestHandler = await ethers.getContractFactory('AgentRequestHandler');
		const agentRequestHandler = await AgentRequestHandler.deploy(await agentRegistry.getAddress());
		await agentRequestHandler.waitForDeployment();

		await agentRegistry.registerAgent(agent1.address, AGENT_TYPE);
		await agentRegistry.registerAgent(agent2.address, AGENT_TYPE);
		await agentRegistry.registerAgent(requester1.address, ethers.id('REQUESTER'));
		await agentRegistry.updateAgentPermissions(agent1.address, [PROCESS_REQUEST_PERMISSION]);
		await agentRegistry.updateAgentPermissions(agent2.address, [PROCESS_REQUEST_PERMISSION]);
		await agentRegistry.updateAgentPermissions(requester1.address, [SUBMIT_REQUEST_PERMISSION]);

		return { agentRequestHandler, agentRegistry, owner, agent1, agent2, requester1, requester2 };
	}

	describe('Deployment', function () {
		it('Should set the correct owner', async function () {
			const { agentRequestHandler, owner } = await loadFixture(deployAgentRequestHandlerFixture);
			expect(await agentRequestHandler.owner()).to.equal(owner.address);
		});

		it('Should initialize with correct default values', async function () {
			const { agentRequestHandler } = await loadFixture(deployAgentRequestHandlerFixture);
			expect(await agentRequestHandler.SUBMIT_REQUEST_PERMISSION()).to.equal(SUBMIT_REQUEST_PERMISSION);
			expect(await agentRequestHandler.PROCESS_REQUEST_PERMISSION()).to.equal(PROCESS_REQUEST_PERMISSION);
			expect(await agentRequestHandler.getCooldownPeriod()).to.equal(DEFAULT_COOLDOWN_PERIOD);
			expect(await agentRequestHandler.getGlobalRequestLimit()).to.equal(DEFAULT_GLOBAL_LIMIT);
		});

		it('Should fail deployment with zero address registry', async function () {
			const AgentRequestHandler = await ethers.getContractFactory('AgentRequestHandler');
			await expect(AgentRequestHandler.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
				AgentRequestHandler,
				'ZeroAddress'
			);
		});
	});

	describe('Request Submission', function () {
		it('Should submit a request successfully', async function () {
			const { agentRequestHandler, agent1, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);

			const tx = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Medium);

			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			expect(event.eventName).to.equal('RequestSubmitted');
			const requestId = event.args[0];
			const request = await agentRequestHandler.getRequest(requestId);

			expect(request.requester).to.equal(requester1.address);
			expect(request.agentAddress).to.equal(agent1.address);
			expect(request.status).to.equal(RequestStatus.Pending);
			expect(request.priority).to.equal(RequestPriority.Medium);
      
			const pendingRequests = await agentRequestHandler.getPendingRequests();
			expect(pendingRequests).to.include(requestId);
			const requesterRequests = await agentRequestHandler.getRequesterRequests(requester1.address);
			expect(requesterRequests).to.include(requestId);
			const agentRequests = await agentRequestHandler.getAgentRequests(agent1.address);
			expect(agentRequests).to.include(requestId);
		});

		it('Should reject requests from unauthorized requesters', async function () {
			const { agentRequestHandler, agent1, requester2 } = await loadFixture(deployAgentRequestHandlerFixture);

			await expect(
				agentRequestHandler.connect(requester2).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Medium)
			).to.be.revertedWithCustomError(agentRequestHandler, 'Unauthorized');
		});

		it('Should reject requests with zero agent address', async function () {
			const { agentRequestHandler, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);

			await expect(
				agentRequestHandler.connect(requester1).submitRequest(ethers.ZeroAddress, SAMPLE_DATA, RequestPriority.Medium)
			).to.be.revertedWithCustomError(agentRequestHandler, 'ZeroAddress');
		});

		it('Should reject requests with empty data', async function () {
			const { agentRequestHandler, agent1, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);

			await expect(
				agentRequestHandler.connect(requester1).submitRequest(agent1.address, '0x', RequestPriority.Medium)
			).to.be.revertedWithCustomError(agentRequestHandler, 'InvalidRequest');
		});
	});

	describe('Request Processing', function () {
		it('Should allow an agent to process their assigned request', async function () {
			const { agentRequestHandler, agent1, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);
			const tx = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Medium);
			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			const requestId = event.args[0];
			const result = ethers.toUtf8Bytes('Processed result data');
			await expect(agentRequestHandler.connect(agent1).processRequest(requestId, result, true))
				.to.emit(agentRequestHandler, 'RequestStatusUpdated')
				.withArgs(requestId, RequestStatus.Completed)
				.and.to.emit(agentRequestHandler, 'RequestProcessed')
				.withArgs(requestId, true);
			const request = await agentRequestHandler.getRequest(requestId);
			expect(request.status).to.equal(RequestStatus.Completed);
			expect(ethers.hexlify(request.result)).to.equal(ethers.hexlify(result));
			const pendingRequests = await agentRequestHandler.getPendingRequests();
			expect(pendingRequests).to.not.include(requestId);
		});

		it('Should allow request processor with permission to process any request', async function () {
			const { agentRequestHandler, agent1, agent2, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);
			const tx = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Medium);
			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			const requestId = event.args[0];
			const result = ethers.toUtf8Bytes('Processed by agent2');
			await expect(agentRequestHandler.connect(agent2).processRequest(requestId, result, true))
				.to.emit(agentRequestHandler, 'RequestProcessed')
				.withArgs(requestId, true);
		});

		it('Should handle failed request processing', async function () {
			const { agentRequestHandler, agent1, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);
			const tx = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Medium);
			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			const requestId = event.args[0];
			await expect(agentRequestHandler.connect(agent1).processRequest(requestId, '0x', false))
				.to.emit(agentRequestHandler, 'RequestStatusUpdated')
				.withArgs(requestId, RequestStatus.Failed)
				.and.to.emit(agentRequestHandler, 'RequestProcessed')
				.withArgs(requestId, false);
			const request = await agentRequestHandler.getRequest(requestId);
			expect(request.status).to.equal(RequestStatus.Failed);
			expect(request.errorMessage).to.equal('Processing failed');
		});

		it('Should reject processing from unauthorized agents', async function () {
			const { agentRequestHandler, agent1, requester1, requester2 } = await loadFixture(deployAgentRequestHandlerFixture);
			const tx = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Medium);
			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			const requestId = event.args[0];
			await expect(agentRequestHandler.connect(requester2).processRequest(requestId, '0x', true)).to.be.revertedWithCustomError(
				agentRequestHandler,
				'Unauthorized'
			);
		});

		it('Should reject processing non-existent requests', async function () {
			const { agentRequestHandler, agent1 } = await loadFixture(deployAgentRequestHandlerFixture);

			const nonExistentRequestId = ethers.id('non-existent');

			await expect(
				agentRequestHandler.connect(agent1).processRequest(nonExistentRequestId, '0x', true)
			).to.be.revertedWithCustomError(agentRequestHandler, 'RequestNotFound');
		});

		it('Should reject processing already processed requests', async function () {
			const { agentRequestHandler, agent1, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);
			const tx = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Medium);
			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			const requestId = event.args[0];
			await agentRequestHandler.connect(agent1).processRequest(requestId, '0x', true);
			await expect(agentRequestHandler.connect(agent1).processRequest(requestId, '0x', true)).to.be.revertedWithCustomError(
				agentRequestHandler,
				'RequestAlreadyProcessed'
			);
		});
	});

	describe('Request Cancellation', function () {
		it('Should allow requester to cancel their request', async function () {
			const { agentRequestHandler, agent1, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);
			const tx = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Medium);
			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			const requestId = event.args[0];
			await expect(agentRequestHandler.connect(requester1).cancelRequest(requestId))
				.to.emit(agentRequestHandler, 'RequestStatusUpdated')
				.withArgs(requestId, RequestStatus.Cancelled);
			const request = await agentRequestHandler.getRequest(requestId);
			expect(request.status).to.equal(RequestStatus.Cancelled);
			const pendingRequests = await agentRequestHandler.getPendingRequests();
			expect(pendingRequests).to.not.include(requestId);
		});

		it('Should allow assigned agent to cancel a request', async function () {
			const { agentRequestHandler, agent1, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);
			const tx = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Medium);
			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			const requestId = event.args[0];
			await expect(agentRequestHandler.connect(agent1).cancelRequest(requestId))
				.to.emit(agentRequestHandler, 'RequestStatusUpdated')
				.withArgs(requestId, RequestStatus.Cancelled);
		});

		it('Should allow admin with processing permission to cancel any request', async function () {
			const { agentRequestHandler, agent1, agent2, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);
			const tx = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Medium);
			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			const requestId = event.args[0];
			await expect(agentRequestHandler.connect(agent2).cancelRequest(requestId))
				.to.emit(agentRequestHandler, 'RequestStatusUpdated')
				.withArgs(requestId, RequestStatus.Cancelled);
		});

		it('Should reject cancellation from unauthorized accounts', async function () {
			const { agentRequestHandler, agent1, requester1, requester2 } = await loadFixture(deployAgentRequestHandlerFixture);
			const tx = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Medium);
			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			const requestId = event.args[0];
			await expect(agentRequestHandler.connect(requester2).cancelRequest(requestId)).to.be.revertedWithCustomError(
				agentRequestHandler,
				'Unauthorized'
			);
		});
	});

	describe('Request Query Functions', function () {
		it('Should return correct request details', async function () {
			const { agentRequestHandler, agent1, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);
			const tx = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.High);
			const receipt = await tx.wait();
			const event = receipt?.logs[0] as EventLog;
			const requestId = event.args[0];
			const request = await agentRequestHandler.getRequest(requestId);
			expect(request.requester).to.equal(requester1.address);
			expect(request.agentAddress).to.equal(agent1.address);
			expect(ethers.hexlify(request.data)).to.equal(ethers.hexlify(SAMPLE_DATA));
			expect(request.status).to.equal(RequestStatus.Pending);
			expect(request.priority).to.equal(RequestPriority.High);
		});

		it('Should return all pending requests', async function () {
			const { agentRequestHandler, agent1, agent2, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);
			const tx1 = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Low);
			await time.increase(61);
			const tx2 = await agentRequestHandler.connect(requester1).submitRequest(agent2.address, SAMPLE_DATA, RequestPriority.Medium);

			const receipt1 = await tx1.wait();
			const receipt2 = await tx2.wait();
			const event1 = receipt1?.logs[0] as EventLog;
			const event2 = receipt2?.logs[0] as EventLog;
			const requestId1 = event1.args[0];
			const requestId2 = event2.args[0];
			const pendingRequests = await agentRequestHandler.getPendingRequests();
			expect(pendingRequests.length).to.equal(2);
			expect(pendingRequests).to.include(requestId1);
			expect(pendingRequests).to.include(requestId2);
			await agentRequestHandler.connect(agent1).processRequest(requestId1, '0x', true);
			const updatedPendingRequests = await agentRequestHandler.getPendingRequests();
			expect(updatedPendingRequests.length).to.equal(1);
			expect(updatedPendingRequests).to.include(requestId2);
			expect(updatedPendingRequests).to.not.include(requestId1);
		});

		it("Should return requester's requests", async function () {
			const { agentRequestHandler, agent1, agent2, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);
			const tx1 = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Low);
			await time.increase(61);
			const tx2 = await agentRequestHandler.connect(requester1).submitRequest(agent2.address, SAMPLE_DATA, RequestPriority.Medium);

			const receipt1 = await tx1.wait();
			const receipt2 = await tx2.wait();
			const event1 = receipt1?.logs[0] as EventLog;
			const event2 = receipt2?.logs[0] as EventLog;
			const requestId1 = event1.args[0];
			const requestId2 = event2.args[0];
			const requesterRequests = await agentRequestHandler.getRequesterRequests(requester1.address);
			expect(requesterRequests.length).to.equal(2);
			expect(requesterRequests).to.include(requestId1);
			expect(requesterRequests).to.include(requestId2);
		});

		it("Should return agent's requests", async function () {
			const { agentRequestHandler, agent1, agent2, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);
			const tx1 = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Low);
			await time.increase(61);
			const tx2 = await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Medium);
			await time.increase(61);

			const tx3 = await agentRequestHandler.connect(requester1).submitRequest(agent2.address, SAMPLE_DATA, RequestPriority.High);

			const receipt1 = await tx1.wait();
			const receipt2 = await tx2.wait();
			const receipt3 = await tx3.wait();
			const event1 = receipt1?.logs[0] as EventLog;
			const event2 = receipt2?.logs[0] as EventLog;
			const event3 = receipt3?.logs[0] as EventLog;
			const requestId1 = event1.args[0];
			const requestId2 = event2.args[0];
			const requestId3 = event3.args[0];
			const agent1Requests = await agentRequestHandler.getAgentRequests(agent1.address);
			expect(agent1Requests.length).to.equal(2);
			expect(agent1Requests).to.include(requestId1);
			expect(agent1Requests).to.include(requestId2);
			expect(agent1Requests).to.not.include(requestId3);
			const agent2Requests = await agentRequestHandler.getAgentRequests(agent2.address);
			expect(agent2Requests.length).to.equal(1);
			expect(agent2Requests).to.include(requestId3);
		});
	});

	describe('Rate Limiting', function () {
		it('Should enforce per-agent request limits', async function () {
			const { agentRequestHandler, agent1, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);
			await agentRequestHandler.setRequestLimit(requester1.address, 2);
			await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Low);
			await time.increase(61);

			await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Medium);
			await time.increase(61);
			await expect(
				agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.High)
			).to.be.revertedWithCustomError(agentRequestHandler, 'RequestLimitExceeded');
		});

		it('Should enforce global request limits', async function () {
			const { agentRequestHandler, agent1, agent2, requester1, owner } = await loadFixture(deployAgentRequestHandlerFixture);
			await agentRequestHandler.connect(owner).setGlobalRequestLimit(2);
			await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Low);
			await time.increase(61);

			await agentRequestHandler.connect(requester1).submitRequest(agent2.address, SAMPLE_DATA, RequestPriority.Medium);
			await time.increase(61);
			await expect(
				agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.High)
			).to.be.revertedWithCustomError(agentRequestHandler, 'RequestLimitExceeded');
		});

		it('Should enforce cooldown periods between requests', async function () {
			const { agentRequestHandler, agent1, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);
			await agentRequestHandler.setCooldownPeriod(3600);
			await agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.Medium);
			await expect(
				agentRequestHandler.connect(requester1).submitRequest(agent1.address, SAMPLE_DATA, RequestPriority.High)
			).to.be.revertedWithCustomError(agentRequestHandler, 'CooldownPeriodNotElapsed');
		});
	});

	describe('Configuration', function () {
		it('Should allow owner to set agent request limits', async function () {
			const { agentRequestHandler, agent1, owner } = await loadFixture(deployAgentRequestHandlerFixture);

			const newLimit = 50;
			await expect(agentRequestHandler.connect(owner).setRequestLimit(agent1.address, newLimit))
				.to.emit(agentRequestHandler, 'RequestLimitUpdated')
				.withArgs(agent1.address, newLimit);
		});

		it('Should allow owner to set global request limit', async function () {
			const { agentRequestHandler, owner } = await loadFixture(deployAgentRequestHandlerFixture);

			const newLimit = 500;
			await expect(agentRequestHandler.connect(owner).setGlobalRequestLimit(newLimit))
				.to.emit(agentRequestHandler, 'GlobalRequestLimitUpdated')
				.withArgs(newLimit);

			expect(await agentRequestHandler.getGlobalRequestLimit()).to.equal(newLimit);
		});

		it('Should allow owner to set cooldown period', async function () {
			const { agentRequestHandler, owner } = await loadFixture(deployAgentRequestHandlerFixture);

			const newPeriod = 120;
			await expect(agentRequestHandler.connect(owner).setCooldownPeriod(newPeriod))
				.to.emit(agentRequestHandler, 'CooldownPeriodUpdated')
				.withArgs(newPeriod);

			expect(await agentRequestHandler.getCooldownPeriod()).to.equal(newPeriod);
		});

		it('Should allow owner to update agent registry', async function () {
			const { agentRequestHandler, owner } = await loadFixture(deployAgentRequestHandlerFixture);
			const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
			const newRegistry = await AgentRegistry.deploy();
			await newRegistry.waitForDeployment();
			await agentRequestHandler.connect(owner).updateAgentRegistry(await newRegistry.getAddress());
		});

		it('Should reject configuration changes from non-owners', async function () {
			const { agentRequestHandler, agent1, requester1 } = await loadFixture(deployAgentRequestHandlerFixture);

			await expect(agentRequestHandler.connect(requester1).setRequestLimit(agent1.address, 10)).to.be.revertedWithCustomError(
				agentRequestHandler,
				'OwnableUnauthorizedAccount'
			);

			await expect(agentRequestHandler.connect(requester1).setGlobalRequestLimit(500)).to.be.revertedWithCustomError(
				agentRequestHandler,
				'OwnableUnauthorizedAccount'
			);

			await expect(agentRequestHandler.connect(requester1).setCooldownPeriod(120)).to.be.revertedWithCustomError(
				agentRequestHandler,
				'OwnableUnauthorizedAccount'
			);
		});

		it('Should reject zero address in agent registry update', async function () {
			const { agentRequestHandler } = await loadFixture(deployAgentRequestHandlerFixture);

			await expect(agentRequestHandler.updateAgentRegistry(ethers.ZeroAddress)).to.be.revertedWithCustomError(
				agentRequestHandler,
				'ZeroAddress'
			);
		});

		it('Should reject zero value for global request limit', async function () {
			const { agentRequestHandler } = await loadFixture(deployAgentRequestHandlerFixture);

			await expect(agentRequestHandler.setGlobalRequestLimit(0)).to.be.revertedWithCustomError(agentRequestHandler, 'ZeroValue');
		});
	});
});
