import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('BaseStrategyAgent', function () {
	async function deployFixture() {
		const [owner, user1, user2] = await ethers.getSigners();
		const MockToken = await ethers.getContractFactory('MockToken');
		const token = await MockToken.deploy('Mock Token', 'MTKN', 18);
		await token.waitForDeployment();
		const MockPositionManager = await ethers.getContractFactory('MockPositionManager');
		const positionManager = await MockPositionManager.deploy();
		await positionManager.waitForDeployment();
		const ConcreteStrategyAgent = await ethers.getContractFactory('ConcreteStrategyAgent');
		const strategyAgent = await ConcreteStrategyAgent.deploy();
		await strategyAgent.waitForDeployment();
    
		const supportedTokens = [await token.getAddress()];
		const minInvestment = ethers.parseEther('1');
		const performanceFee = 500;
		const riskLevel = ethers.encodeBytes32String('MEDIUM');
		const initData = ethers.AbiCoder.defaultAbiCoder().encode(
			['string', 'string', 'address[]', 'uint256', 'bytes32', 'uint256', 'address'],
			[
				'Test Strategy',
				'A test strategy for unit testing',
				supportedTokens,
				minInvestment,
				riskLevel,
				performanceFee,
				await positionManager.getAddress(),
			]
		);

		await strategyAgent.initialize(initData);
		await strategyAgent.activateStrategy();
		await token.mint(user1.address, ethers.parseEther('100'));
		await token.mint(user2.address, ethers.parseEther('100'));

		return {
			strategyAgent,
			positionManager,
			token,
			owner,
			user1,
			user2,
			minInvestment,
			performanceFee,
			riskLevel,
		};
	}

	describe('Initialization', function () {
		it('Should initialize with correct parameters', async function () {
			const { strategyAgent, positionManager, token, minInvestment, performanceFee, riskLevel } = await loadFixture(deployFixture);

			const strategyInfo = await strategyAgent.getStrategyInfo();

			expect(strategyInfo.name).to.equal('Test Strategy');
			expect(strategyInfo.description).to.equal('A test strategy for unit testing');
			expect(strategyInfo.supportedTokens[0]).to.equal(await token.getAddress());
			expect(strategyInfo.minInvestment).to.equal(minInvestment);
			expect(strategyInfo.riskLevel).to.equal(riskLevel);
			expect(strategyInfo.performanceFee).to.equal(performanceFee);
			expect(strategyInfo.active).to.be.true;
			expect(strategyInfo.implementation).to.equal(await strategyAgent.getAddress());

			expect(await strategyAgent.positionManager()).to.equal(await positionManager.getAddress());
		});

		it('Should not allow initializing twice', async function () {
			const { strategyAgent, positionManager, token } = await loadFixture(deployFixture);

			const supportedTokens = [await token.getAddress()];
			const initData = ethers.AbiCoder.defaultAbiCoder().encode(
				['string', 'string', 'address[]', 'uint256', 'bytes32', 'uint256', 'address'],
				[
					'Test Strategy',
					'A test strategy for unit testing',
					supportedTokens,
					ethers.parseEther('1'),
					ethers.encodeBytes32String('MEDIUM'),
					500,
					await positionManager.getAddress(),
				]
			);

			await expect(strategyAgent.initialize(initData)).to.be.revertedWithCustomError(strategyAgent, 'AlreadyInitialized');
		});
	});

	describe('Token Support', function () {
		it('Should correctly identify supported tokens', async function () {
			const { strategyAgent, token } = await loadFixture(deployFixture);

			expect(await strategyAgent.isTokenSupported(await token.getAddress())).to.be.true;
			const randomAddress = ethers.Wallet.createRandom().address;
			expect(await strategyAgent.isTokenSupported(randomAddress)).to.be.false;
		});

		it('Should allow adding supported tokens', async function () {
			const { strategyAgent, owner } = await loadFixture(deployFixture);

			const newToken = ethers.Wallet.createRandom().address;
			await strategyAgent.connect(owner).addSupportedToken(newToken);

			expect(await strategyAgent.isTokenSupported(newToken)).to.be.true;
			const strategyInfo = await strategyAgent.getStrategyInfo();
			expect(strategyInfo.supportedTokens).to.include(newToken);
		});

		it('Should allow removing supported tokens', async function () {
			const { strategyAgent, token, owner } = await loadFixture(deployFixture);

			const tokenAddress = await token.getAddress();
			await strategyAgent.connect(owner).removeSupportedToken(tokenAddress);

			expect(await strategyAgent.isTokenSupported(tokenAddress)).to.be.false;
		});
	});

	describe('Strategy Activation', function () {
		it('Should allow deactivating the strategy', async function () {
			const { strategyAgent, owner } = await loadFixture(deployFixture);

			await strategyAgent.connect(owner).deactivateStrategy();

			const strategyInfo = await strategyAgent.getStrategyInfo();
			expect(strategyInfo.active).to.be.false;
		});

		it('Should allow reactivating the strategy', async function () {
			const { strategyAgent, owner } = await loadFixture(deployFixture);

			await strategyAgent.connect(owner).deactivateStrategy();
			await strategyAgent.connect(owner).activateStrategy();

			const strategyInfo = await strategyAgent.getStrategyInfo();
			expect(strategyInfo.active).to.be.true;
		});
	});

	describe('Position Management', function () {
		it('Should allow opening a position', async function () {
			const { strategyAgent, token, user1, positionManager } = await loadFixture(deployFixture);
			const positionId = 1;
			await positionManager.setNextPositionId(positionId);
			const amount = ethers.parseEther('10');
			await token.connect(user1).approve(await strategyAgent.getAddress(), amount);
			const tx = await strategyAgent.connect(user1).entryPosition(await token.getAddress(), amount);
			await expect(tx)
				.to.emit(strategyAgent, 'PositionOpened')
				.withArgs(positionId, user1.address, await token.getAddress(), amount);
			expect(await positionManager.getPositionOpenCount()).to.equal(1);
		});

		it('Should revert when opening a position with unsupported token', async function () {
			const { strategyAgent, user1 } = await loadFixture(deployFixture);

			const unsupportedToken = ethers.Wallet.createRandom().address;
			const amount = ethers.parseEther('10');

			await expect(strategyAgent.connect(user1).entryPosition(unsupportedToken, amount)).to.be.revertedWithCustomError(
				strategyAgent,
				'UnsupportedToken'
			);
		});

		it('Should revert when opening position below minimum investment', async function () {
			const { strategyAgent, token, user1, minInvestment } = await loadFixture(deployFixture);

			const smallAmount = ethers.parseEther('0.1');
			await token.connect(user1).approve(await strategyAgent.getAddress(), smallAmount);

			await expect(strategyAgent.connect(user1).entryPosition(await token.getAddress(), smallAmount)).to.be.revertedWithCustomError(
				strategyAgent,
				'InsufficientAmount'
			);
		});
	});

	describe('Strategy Updates', function () {
		it('Should allow updating description', async function () {
			const { strategyAgent, owner } = await loadFixture(deployFixture);

			const newDescription = 'Updated strategy description';
			await strategyAgent.connect(owner).updateDescription(newDescription);

			const strategyInfo = await strategyAgent.getStrategyInfo();
			expect(strategyInfo.description).to.equal(newDescription);
		});

		it('Should allow updating minimum investment', async function () {
			const { strategyAgent, owner } = await loadFixture(deployFixture);

			const newMinInvestment = ethers.parseEther('5');
			await strategyAgent.connect(owner).updateMinInvestment(newMinInvestment);

			const strategyInfo = await strategyAgent.getStrategyInfo();
			expect(strategyInfo.minInvestment).to.equal(newMinInvestment);
		});

		it('Should allow updating performance fee', async function () {
			const { strategyAgent, owner } = await loadFixture(deployFixture);

			const newPerformanceFee = 300;
			await strategyAgent.connect(owner).updatePerformanceFee(newPerformanceFee);

			const strategyInfo = await strategyAgent.getStrategyInfo();
			expect(strategyInfo.performanceFee).to.equal(newPerformanceFee);
		});

		it('Should allow updating risk level', async function () {
			const { strategyAgent, owner } = await loadFixture(deployFixture);

			const newRiskLevel = ethers.encodeBytes32String('HIGH');
			await strategyAgent.connect(owner).updateRiskLevel(newRiskLevel);

			const strategyInfo = await strategyAgent.getStrategyInfo();
			expect(strategyInfo.riskLevel).to.equal(newRiskLevel);
		});

		it('Should allow updating performance metrics', async function () {
			const { strategyAgent, owner } = await loadFixture(deployFixture);

			const newTVL = ethers.parseEther('1000000');
			const newAPY = 1500;
			const newRiskScore = 60;
			await strategyAgent.connect(owner).updatePerformanceMetrics(newTVL, newAPY, newRiskScore);

			expect(await strategyAgent.tvl()).to.equal(newTVL);
			expect(await strategyAgent.getAPY()).to.equal(newAPY);
			expect(await strategyAgent.getRiskScore()).to.equal(newRiskScore);
		});
	});

	describe('Emergency Function', function () {
		it('Should allow emergency withdrawal', async function () {
			const { strategyAgent, token, owner } = await loadFixture(deployFixture);
			const amount = ethers.parseEther('10');
			await token.mint(await strategyAgent.getAddress(), amount);

			const recipient = ethers.Wallet.createRandom().address;
			await strategyAgent.connect(owner).emergencyWithdraw(await token.getAddress(), amount, recipient);
			expect(await token.balanceOf(recipient)).to.equal(amount);
		});

		it('Should revert emergency withdrawal from non-owner', async function () {
			const { strategyAgent, token, user1 } = await loadFixture(deployFixture);

			const amount = ethers.parseEther('10');
			const recipient = ethers.Wallet.createRandom().address;

			await expect(
				strategyAgent.connect(user1).emergencyWithdraw(await token.getAddress(), amount, recipient)
			).to.be.revertedWithCustomError(strategyAgent, 'OwnableUnauthorizedAccount');
		});
	});
});
