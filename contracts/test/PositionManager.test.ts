import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('PositionManager', function () {
	async function deployFixture() {
		const [owner, user1, user2] = await ethers.getSigners();
		const MockToken = await ethers.getContractFactory('MockToken');
		const token = await MockToken.deploy('Mock Token', 'MTK', 18);
		await token.waitForDeployment();
		const MockStrategyAgent = await ethers.getContractFactory('MockStrategyAgent');
		const strategy = await MockStrategyAgent.deploy();
		await strategy.waitForDeployment();
		const strategyId = ethers.encodeBytes32String('MOCK_STRATEGY');
		await strategy.initialize(
			strategyId,
			'Mock Strategy',
			'A strategy for testing',
			[await token.getAddress()],
			ethers.parseEther('1'),
			ethers.encodeBytes32String('LOW'),
			500
		);
		const PositionManager = await ethers.getContractFactory('PositionManager');
		const positionManager = await PositionManager.deploy();
		await positionManager.waitForDeployment();
		await positionManager.registerStrategy(await strategy.getAddress());
		await token.mint(owner.address, ethers.parseEther('1000'));
		await token.mint(user1.address, ethers.parseEther('1000'));
		await token.mint(user2.address, ethers.parseEther('1000'));

		return {
			positionManager,
			strategy,
			strategyId,
			token,
			owner,
			user1,
			user2,
		};
	}

	describe('InitializationAndStrategyManagement', function () {
		it('Should initialize with correct owner', async function () {
			const { positionManager, owner } = await loadFixture(deployFixture);
			expect(await positionManager.owner()).to.equal(owner.address);
		});

		it('shouldRegisterStrategyCorrectly', async function () {
			const { positionManager, strategy, strategyId } = await loadFixture(deployFixture);
			expect(await positionManager.isStrategyRegistered(strategyId)).to.be.true;

			const strategies = await positionManager.getRegisteredStrategies();
			expect(strategies).to.include(await strategy.getAddress());
		});

		it('shouldNotAllowRegisteringTheSameStrategyTwice', async function () {
			const { positionManager, strategy } = await loadFixture(deployFixture);
			await expect(positionManager.registerStrategy(await strategy.getAddress())).to.be.revertedWithCustomError(
				positionManager,
				'StrategyAlreadyRegistered'
			);
		});

		it('shouldAllowDeregisteringARegisteredStrategy', async function () {
			const { positionManager, strategyId } = await loadFixture(deployFixture);
			await positionManager.deregisterStrategy(strategyId);
			expect(await positionManager.isStrategyRegistered(strategyId)).to.be.false;
		});

		it('shouldNotAllowDeregisteringANonRegisteredStrategy', async function () {
			const { positionManager } = await loadFixture(deployFixture);
			const invalidId = ethers.encodeBytes32String('INVALID');
			await expect(positionManager.deregisterStrategy(invalidId)).to.be.revertedWithCustomError(
				positionManager,
				'StrategyNotRegistered'
			);
		});
	});

	describe('PositionOpening', function () {
		it('shouldOpenPositionCorrectly', async function () {
			const { positionManager, token, strategyId, user1 } = await loadFixture(deployFixture);
			const amount = ethers.parseEther('10');

			await token.connect(user1).approve(await positionManager.getAddress(), amount);

			const tx = await positionManager.connect(user1).openPosition(strategyId, await token.getAddress(), amount, '0x');
			await expect(tx)
				.to.emit(positionManager, 'PositionOpened')
				.withArgs(1, user1.address, strategyId, await token.getAddress(), amount);
			const position = await positionManager.getPosition(1);
			expect(position.owner).to.equal(user1.address);
			expect(position.strategyId).to.equal(strategyId);
			expect(position.tokens[0]).to.equal(await token.getAddress());
			expect(position.amounts[0]).to.equal(amount);
			expect(position.status).to.equal(0);
		});

		it('shouldNotAllowOpeningPositionWithUnregisteredStrategy', async function () {
			const { positionManager, token, user1 } = await loadFixture(deployFixture);
			const invalidId = ethers.encodeBytes32String('INVALID');
			const amount = ethers.parseEther('10');

			await expect(
				positionManager.connect(user1).openPosition(invalidId, await token.getAddress(), amount, '0x')
			).to.be.revertedWithCustomError(positionManager, 'StrategyNotRegistered');
		});

		it('shouldNotAllowOpeningPositionWithZeroAmount', async function () {
			const { positionManager, token, strategyId, user1 } = await loadFixture(deployFixture);

			await expect(positionManager.connect(user1).openPosition(strategyId, await token.getAddress(), 0, '0x'))
				.to.be.revertedWithCustomError(positionManager, 'ZeroValue')
				.withArgs('amount');
		});

		it('shouldNotAllowOpeningPositionWithZeroAddressToken', async function () {
			const { positionManager, strategyId, user1 } = await loadFixture(deployFixture);
			const amount = ethers.parseEther('10');

			await expect(
				positionManager.connect(user1).openPosition(strategyId, ethers.ZeroAddress, amount, '0x')
			).to.be.revertedWithCustomError(positionManager, 'ZeroAddress');
		});
	});

	describe('PositionManagement', function () {
		async function setupPosition() {
			const fixture = await deployFixture();
			const { positionManager, token, strategyId, user1 } = fixture;
			const amount = ethers.parseEther('10');

			await token.connect(user1).approve(await positionManager.getAddress(), amount);
			await positionManager.connect(user1).openPosition(strategyId, await token.getAddress(), amount, '0x');

			return { ...fixture, positionId: 1, amount };
		}

		it('shouldGetPositionCorrectly', async function () {
			const { positionManager, positionId, strategyId, token, user1, amount } = await setupPosition();

			const position = await positionManager.getPosition(positionId);
			expect(position.id).to.equal(positionId);
			expect(position.owner).to.equal(user1.address);
			expect(position.strategyId).to.equal(strategyId);
			expect(position.tokens[0]).to.equal(await token.getAddress());
			expect(position.amounts[0]).to.equal(amount);
			expect(position.status).to.equal(0);
		});

		it('shouldGetActivePositionsForOwner', async function () {
			const { positionManager, positionId, user1 } = await setupPosition();

			const activePositions = await positionManager.getActivePositions(user1.address);
			expect(activePositions.length).to.equal(1);
			expect(activePositions[0]).to.equal(positionId);
		});

		it('shouldClosePosition', async function () {
			const { positionManager, positionId, user1 } = await setupPosition();

			const tx = await positionManager.connect(user1).closePosition(positionId, '0x');
			await expect(tx).to.emit(positionManager, 'PositionClosed').withArgs(positionId, user1.address);

			await expect(tx).to.emit(positionManager, 'PositionStatusChanged').withArgs(positionId, 0, 1);
			const position = await positionManager.getPosition(positionId);
			expect(position.status).to.equal(1);
		});

		it('shouldNotAllowClosingPositionByNonOwner', async function () {
			const { positionManager, positionId, user2 } = await setupPosition();

			await expect(positionManager.connect(user2).closePosition(positionId, '0x')).to.be.revertedWithCustomError(
				positionManager,
				'Unauthorized'
			);
		});

		it('shouldGetPositionsForStrategy', async function () {
			const { positionManager, positionId, strategyId } = await setupPosition();

			const positions = await positionManager.getPositionsForStrategy(strategyId);
			expect(positions.length).to.equal(1);
			expect(positions[0]).to.equal(positionId);
		});

		it('shouldModifyPosition', async function () {
			const { positionManager, positionId, user1, token } = await setupPosition();
			const newAmount = ethers.parseEther('20');

			await token.connect(user1).approve(await positionManager.getAddress(), newAmount);

			const tx = await positionManager.connect(user1).modifyPosition(positionId, newAmount, '0x');
			await expect(tx).to.emit(positionManager, 'PositionModified').withArgs(positionId, user1.address, newAmount);
			const position = await positionManager.getPosition(positionId);
			expect(position.amounts[0]).to.equal(newAmount);
		});

		it('shouldNotAllowModifyingClosedPosition', async function () {
			const { positionManager, positionId, user1 } = await setupPosition();
			await positionManager.connect(user1).closePosition(positionId, '0x');
			const newAmount = ethers.parseEther('20');
			await expect(positionManager.connect(user1).modifyPosition(positionId, newAmount, '0x')).to.be.revertedWithCustomError(
				positionManager,
				'InvalidPosition'
			);
		});
	});

	describe('PerformanceAndInformation', function () {
		it('shouldTrackTotalValueLocked', async function () {
			const { positionManager, token, strategyId, user1 } = await loadFixture(deployFixture);
			const amount = ethers.parseEther('10');

			await token.connect(user1).approve(await positionManager.getAddress(), amount);
			await positionManager.connect(user1).openPosition(strategyId, await token.getAddress(), amount, '0x');

			expect(await positionManager.getTotalValueLocked()).to.equal(amount);
			await token.connect(user1).approve(await positionManager.getAddress(), amount);
			await positionManager.connect(user1).openPosition(strategyId, await token.getAddress(), amount, '0x');

			expect(await positionManager.getTotalValueLocked()).to.equal(amount * BigInt(2));
		});

		it('shouldTrackPositionCount', async function () {
			const { positionManager, token, strategyId, user1, user2 } = await loadFixture(deployFixture);
			const amount = ethers.parseEther('10');

			expect(await positionManager.getPositionCount()).to.equal(0);
			await token.connect(user1).approve(await positionManager.getAddress(), amount);
			await positionManager.connect(user1).openPosition(strategyId, await token.getAddress(), amount, '0x');

			await token.connect(user2).approve(await positionManager.getAddress(), amount);
			await positionManager.connect(user2).openPosition(strategyId, await token.getAddress(), amount, '0x');

			expect(await positionManager.getPositionCount()).to.equal(2);
		});

		it('shouldCheckPositionOwnershipCorrectly', async function () {
			const { positionManager, token, strategyId, user1, user2 } = await loadFixture(deployFixture);
			const amount = ethers.parseEther('10');
			await token.connect(user1).approve(await positionManager.getAddress(), amount);
			await positionManager.connect(user1).openPosition(strategyId, await token.getAddress(), amount, '0x');

			expect(await positionManager.isPositionOwner(1, user1.address)).to.be.true;
			expect(await positionManager.isPositionOwner(1, user2.address)).to.be.false;
		});
	});
});
