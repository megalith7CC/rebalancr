import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('AaveYieldStrategy', function () {
	async function deployFixture() {
		const [owner, user1, user2, mockAavePool, mockAaveOracle] = await ethers.getSigners();
		const MockToken = await ethers.getContractFactory('MockToken');
		const token = await MockToken.deploy('Mock Token', 'MTKN', 18);
		await token.waitForDeployment();
		const secondToken = await MockToken.deploy('Second Token', 'STK', 6);
		await secondToken.waitForDeployment();
		const MockPositionManager = await ethers.getContractFactory('MockPositionManager');
		const positionManager = await MockPositionManager.deploy();
		await positionManager.waitForDeployment();
		const ChainlinkPriceOracle = await ethers.getContractFactory('ChainlinkPriceOracle');
		const priceOracle = await ChainlinkPriceOracle.deploy(await token.getAddress());
		await priceOracle.waitForDeployment();
		const mockPriceFeed = ethers.Wallet.createRandom().address;
		await priceOracle.setPriceFeed(await token.getAddress(), mockPriceFeed);
		await priceOracle.setPriceFeed(await secondToken.getAddress(), mockPriceFeed);
		const AaveYieldStrategyTestHelper = await ethers.getContractFactory('AaveYieldStrategyTestHelper');
		const strategy = await AaveYieldStrategyTestHelper.deploy();
		await strategy.waitForDeployment();
		const supportedTokens = [await token.getAddress(), await secondToken.getAddress()];
		const minInvestment = ethers.parseEther('1');
		const performanceFee = 500;
		const riskLevel = ethers.encodeBytes32String('MEDIUM');
		const initData = ethers.AbiCoder.defaultAbiCoder().encode(
			['string', 'string', 'address[]', 'uint256', 'bytes32', 'uint256', 'address'],
			['Aave Yield Strategy', 'A strategy for generating yield through Aave lending', supportedTokens, minInvestment, riskLevel, performanceFee, await positionManager.getAddress()]
		);

		await strategy.initialize(initData);
		const mockATokenAddress = ethers.Wallet.createRandom().address;
		const mockSecondATokenAddress = ethers.Wallet.createRandom().address;
		const aaveInitData = ethers.AbiCoder.defaultAbiCoder().encode(
			['address', 'address', 'address', 'address[]', 'address[]'],
			[mockAavePool.address, mockAaveOracle.address, await priceOracle.getAddress(), [await token.getAddress(), await secondToken.getAddress()], [mockATokenAddress, mockSecondATokenAddress]]
		);

		await strategy.initializeAaveStrategy(aaveInitData);
		await strategy.activateStrategy();
		await token.mint(owner.address, ethers.parseEther('100'));
		await token.mint(user1.address, ethers.parseEther('100'));
		await token.mint(user2.address, ethers.parseEther('100'));
		await secondToken.mint(owner.address, ethers.parseUnits('100', 6));
		await secondToken.mint(user1.address, ethers.parseUnits('100', 6));
		await secondToken.mint(user2.address, ethers.parseUnits('100', 6));
		return {
			strategy,
			positionManager,
			token,
			secondToken,
			priceOracle,
			owner,
			user1,
			user2,
			mockAavePool,
			mockAaveOracle,
			mockATokenAddress,
			mockSecondATokenAddress,
			minInvestment,
			performanceFee,
			riskLevel,
		};
	}

	describe('Initialization', function () {
		it('Should initialize with correct parameters', async function () {
			const { strategy, token, secondToken, positionManager, mockAavePool, mockAaveOracle, priceOracle, mockATokenAddress, mockSecondATokenAddress } = await loadFixture(deployFixture);
			const strategyInfo = await strategy.getStrategyInfo();
			expect(strategyInfo.name).to.equal('Aave Yield Strategy');
			expect(strategyInfo.description).to.equal('A strategy for generating yield through Aave lending');
			expect(strategyInfo.supportedTokens[0]).to.equal(await token.getAddress());
			expect(strategyInfo.supportedTokens[1]).to.equal(await secondToken.getAddress());
			expect(strategyInfo.active).to.be.true;
			expect(await strategy.aavePool()).to.equal(mockAavePool.address);
			expect(await strategy.aaveOracle()).to.equal(mockAaveOracle.address);
			expect(await strategy.priceOracle()).to.equal(await priceOracle.getAddress());
			expect(await strategy.getAToken(await token.getAddress())).to.equal(mockATokenAddress);
			expect(await strategy.getAToken(await secondToken.getAddress())).to.equal(mockSecondATokenAddress);
			expect(await strategy.tokenDecimals(await token.getAddress())).to.equal(18);
			expect(await strategy.tokenDecimals(await secondToken.getAddress())).to.equal(6);
		});

		it('Should not allow initializing Aave strategy twice', async function () {
			const { strategy, token, mockAavePool, mockAaveOracle, priceOracle } = await loadFixture(deployFixture);

			const mockATokenAddress = ethers.Wallet.createRandom().address;
			const aaveInitData = ethers.AbiCoder.defaultAbiCoder().encode(
				['address', 'address', 'address', 'address[]', 'address[]'],
				[mockAavePool.address, mockAaveOracle.address, await priceOracle.getAddress(), [await token.getAddress()], [mockATokenAddress]]
			);
			await expect(strategy.initializeAaveStrategy(aaveInitData)).to.be.revertedWithCustomError(strategy, 'AlreadyInitialized');
		});

		it('Should emit events during initialization', async function () {
			const [owner, mockAavePool, mockAaveOracle] = await ethers.getSigners();
			const AaveYieldStrategyTestHelper = await ethers.getContractFactory('AaveYieldStrategyTestHelper');
			const newStrategy = await AaveYieldStrategyTestHelper.deploy();
			await newStrategy.waitForDeployment();
			const MockToken = await ethers.getContractFactory('MockToken');
			const mockToken = await MockToken.deploy('Mock Token', 'MTKN', 18);
			await mockToken.waitForDeployment();

			const ChainlinkPriceOracle = await ethers.getContractFactory('ChainlinkPriceOracle');
			const mockPriceOracle = await ChainlinkPriceOracle.deploy(await mockToken.getAddress());
			await mockPriceOracle.waitForDeployment();

			const MockPositionManager = await ethers.getContractFactory('MockPositionManager');
			const mockPositionManager = await MockPositionManager.deploy();
			await mockPositionManager.waitForDeployment();
			const supportedTokens = [await mockToken.getAddress()];
			const initData = ethers.AbiCoder.defaultAbiCoder().encode(
				['string', 'string', 'address[]', 'uint256', 'bytes32', 'uint256', 'address'],
				['Aave Yield Strategy', 'A strategy for generating yield', supportedTokens, ethers.parseEther('1'), ethers.encodeBytes32String('MEDIUM'), 500, await mockPositionManager.getAddress()]
			);

			await newStrategy.initialize(initData);
			const mockATokenAddress = ethers.Wallet.createRandom().address;
			const aaveInitData = ethers.AbiCoder.defaultAbiCoder().encode(
				['address', 'address', 'address', 'address[]', 'address[]'],
				[mockAavePool.address, mockAaveOracle.address, await mockPriceOracle.getAddress(), supportedTokens, [mockATokenAddress]]
			);
			await expect(newStrategy.initializeAaveStrategy(aaveInitData))
				.to.emit(newStrategy, 'AavePoolUpdated')
				.withArgs(mockAavePool.address)
				.and.to.emit(newStrategy, 'AaveOracleUpdated')
				.withArgs(mockAaveOracle.address)
				.and.to.emit(newStrategy, 'PriceOracleUpdated')
				.withArgs(await mockPriceOracle.getAddress())
				.and.to.emit(newStrategy, 'ATokenAdded')
				.withArgs(await mockToken.getAddress(), mockATokenAddress);
		});
	});

	describe('Configuration Management', function () {
		it('Should allow updating the Aave Pool address', async function () {
			const { strategy, owner } = await loadFixture(deployFixture);

			const newPoolAddress = ethers.Wallet.createRandom().address;

			await expect(strategy.connect(owner).updateAavePool(newPoolAddress)).to.emit(strategy, 'AavePoolUpdated').withArgs(newPoolAddress);

			expect(await strategy.aavePool()).to.equal(newPoolAddress);
		});

		it('Should allow updating the Aave Oracle address', async function () {
			const { strategy, owner } = await loadFixture(deployFixture);

			const newOracleAddress = ethers.Wallet.createRandom().address;

			await expect(strategy.connect(owner).updateAaveOracle(newOracleAddress)).to.emit(strategy, 'AaveOracleUpdated').withArgs(newOracleAddress);

			expect(await strategy.aaveOracle()).to.equal(newOracleAddress);
		});

		it('Should allow updating the Price Oracle address', async function () {
			const { strategy, owner } = await loadFixture(deployFixture);

			const newPriceOracleAddress = ethers.Wallet.createRandom().address;

			await expect(strategy.connect(owner).updatePriceOracle(newPriceOracleAddress)).to.emit(strategy, 'PriceOracleUpdated').withArgs(newPriceOracleAddress);

			expect(await strategy.priceOracle()).to.equal(newPriceOracleAddress);
		});

		it('Should allow adding an aToken', async function () {
			const { strategy, owner } = await loadFixture(deployFixture);

			const newToken = ethers.Wallet.createRandom().address;
			const newAToken = ethers.Wallet.createRandom().address;

			await expect(strategy.connect(owner).addAToken(newToken, newAToken)).to.emit(strategy, 'ATokenAdded').withArgs(newToken, newAToken);

			expect(await strategy.getAToken(newToken)).to.equal(newAToken);
		});

		it('Should not allow adding an aToken for an already mapped token', async function () {
			const { strategy, token, owner } = await loadFixture(deployFixture);

			const newAToken = ethers.Wallet.createRandom().address;

			await expect(strategy.connect(owner).addAToken(await token.getAddress(), newAToken)).to.be.revertedWith('Token already mapped to an aToken');
		});

		it('Should not allow non-owner to update configuration', async function () {
			const { strategy, user1 } = await loadFixture(deployFixture);

			const newAddress = ethers.Wallet.createRandom().address;

			await expect(strategy.connect(user1).updateAavePool(newAddress)).to.be.revertedWithCustomError(strategy, 'OwnableUnauthorizedAccount');

			await expect(strategy.connect(user1).updateAaveOracle(newAddress)).to.be.revertedWithCustomError(strategy, 'OwnableUnauthorizedAccount');

			await expect(strategy.connect(user1).updatePriceOracle(newAddress)).to.be.revertedWithCustomError(strategy, 'OwnableUnauthorizedAccount');

			await expect(strategy.connect(user1).addAToken(newAddress, newAddress)).to.be.revertedWithCustomError(strategy, 'OwnableUnauthorizedAccount');
		});

		it('Should handle zero addresses correctly', async function () {
			const { strategy, owner } = await loadFixture(deployFixture);
			const zeroAddress = ethers.ZeroAddress;

			await expect(strategy.connect(owner).updateAavePool(zeroAddress)).to.be.revertedWithCustomError(strategy, 'ZeroAddress').withArgs('newAavePool');

			await expect(strategy.connect(owner).updateAaveOracle(zeroAddress)).to.be.revertedWithCustomError(strategy, 'ZeroAddress').withArgs('newAaveOracle');

			await expect(strategy.connect(owner).updatePriceOracle(zeroAddress)).to.be.revertedWithCustomError(strategy, 'ZeroAddress').withArgs('newPriceOracle');

			await expect(strategy.connect(owner).addAToken(zeroAddress, ethers.Wallet.createRandom().address)).to.be.revertedWithCustomError(strategy, 'ZeroAddress').withArgs('token');

			await expect(strategy.connect(owner).addAToken(ethers.Wallet.createRandom().address, zeroAddress)).to.be.revertedWithCustomError(strategy, 'ZeroAddress').withArgs('aToken');
		});
	});

	describe('Position Management', function () {
		it('Should validate position parameters correctly', async function () {
			const { strategy, token } = await loadFixture(deployFixture);

			const tokenAddress = await token.getAddress();
			const validParams = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'bool'], [tokenAddress, ethers.parseEther('10'), true]);
			const unknownToken = ethers.Wallet.createRandom().address;
			const invalidTokenParams = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'bool'], [unknownToken, ethers.parseEther('10'), true]);
			const zeroAmountParams = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'bool'], [tokenAddress, 0, true]);
			const validResult = await strategy.validate(validParams);
			const invalidTokenResult = await strategy.validate(invalidTokenParams);
			const zeroAmountResult = await strategy.validate(zeroAmountParams);

			expect(validResult).to.be.true;
			expect(invalidTokenResult).to.be.false;
			expect(zeroAmountResult).to.be.false;
		});

		it('Should validate using the internal function', async function () {
			const { strategy, token } = await loadFixture(deployFixture);

			const tokenAddress = await token.getAddress();
			const validParams = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'bool'], [tokenAddress, ethers.parseEther('10'), true]);
			const unknownToken = ethers.Wallet.createRandom().address;
			const invalidTokenParams = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'bool'], [unknownToken, ethers.parseEther('10'), true]);
			const validResult = await strategy.testValidateParams(validParams);
			const invalidTokenResult = await strategy.testValidateParams(invalidTokenParams);

			expect(validResult).to.be.true;
			expect(invalidTokenResult).to.be.false;
		});

		it('Should prepare entry position data correctly', async function () {
			const { strategy, token } = await loadFixture(deployFixture);

			const tokenAddress = await token.getAddress();
			const amount = ethers.parseEther('10');
			const data = await strategy.prepareEntryPosition(tokenAddress, amount);
			const [encodedToken, encodedAmount, isDeposit] = ethers.AbiCoder.defaultAbiCoder().decode(['address', 'uint256', 'bool'], data);

			expect(encodedToken).to.equal(tokenAddress);
			expect(encodedAmount).to.equal(amount);
			expect(isDeposit).to.be.true;
		});

		it('Should prepare exit position data correctly', async function () {
			const { strategy, token, user1 } = await loadFixture(deployFixture);

			const tokenAddress = await token.getAddress();
			const amount = ethers.parseEther('10');
			const positionId = 1;
			const position = {
				id: positionId,
				strategyId: ethers.encodeBytes32String('STRATEGY_ID'),
				owner: user1.address,
				tokens: [tokenAddress],
				amounts: [amount],
				entryTimestamp: Math.floor(Date.now() / 1000),
				lastUpdateTimestamp: Math.floor(Date.now() / 1000),
				status: 0,
				extraData: '0x',
			};
			const data = await strategy.prepareExitPosition(positionId, position);
			const [encodedToken, encodedAmount, isDeposit] = ethers.AbiCoder.defaultAbiCoder().decode(['address', 'uint256', 'bool'], data);

			expect(encodedToken).to.equal(tokenAddress);
			expect(encodedAmount).to.equal(amount);
			expect(isDeposit).to.be.false;
		});

		it('Should execute strategy with valid parameters', async function () {
			const { strategy, token, owner } = await loadFixture(deployFixture);

			const tokenAddress = await token.getAddress();
			const amount = ethers.parseEther('10');

			await token.connect(owner).transfer(await strategy.getAddress(), amount);

			const depositData = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'bool'], [tokenAddress, amount, true]);
			await strategy.setMockSuccessForDeposit(true);
			await expect(strategy.testExecuteStrategy(depositData)).to.emit(strategy, 'Deposited').withArgs(tokenAddress, amount, owner.address);
			const totalDeposit = await strategy.totalDeposits(tokenAddress);
			expect(totalDeposit).to.equal(amount);
			const withdrawData = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'bool'], [tokenAddress, amount, false]);
			await strategy.setMockATokenBalance(tokenAddress, amount);
			await strategy.setMockSuccessForWithdraw(true);
			await expect(strategy.testExecuteStrategy(withdrawData)).to.emit(strategy, 'Withdrawn').withArgs(tokenAddress, amount, owner.address);
			const updatedDeposit = await strategy.totalDeposits(tokenAddress);
			expect(updatedDeposit).to.equal(0);
		});

		it('Should simulate position opening', async function () {
			const { strategy, token, user1, owner } = await loadFixture(deployFixture);

			const tokenAddress = await token.getAddress();
			const amount = ethers.parseEther('5');
			const positionId = 1;
			const aTokenAddr = await strategy.getAToken(tokenAddress);
			expect(aTokenAddr).to.not.equal(ethers.ZeroAddress);
			await token.connect(owner).transfer(await strategy.getAddress(), amount);
			await strategy.setMockSuccessForDeposit(true);
			await expect(strategy.testOnPositionOpened(positionId, tokenAddress, amount)).to.emit(strategy, 'Deposited').withArgs(tokenAddress, amount, owner.address);
			const totalDeposit = await strategy.totalDeposits(tokenAddress);
			expect(totalDeposit).to.equal(amount);
		});

		it('Should fail position opening with zero amount', async function () {
			const { strategy, token, user1 } = await loadFixture(deployFixture);

			const tokenAddress = await token.getAddress();
			const amount = 0;
			const positionId = 1;
			await strategy.setMockSuccessForDeposit(true);
			await expect(strategy.testOnPositionOpened(positionId, tokenAddress, amount)).to.be.revertedWithCustomError(strategy, 'ZeroAmount');
		});

		it('Should fail position opening with unmapped token', async function () {
			const { strategy, user1 } = await loadFixture(deployFixture);

			const unmappedToken = ethers.Wallet.createRandom().address;
			const amount = ethers.parseEther('5');
			const positionId = 1;
			await strategy.setMockSuccessForDeposit(true);
			await expect(strategy.testOnPositionOpened(positionId, unmappedToken, amount)).to.be.revertedWithCustomError(strategy, 'TokenNotMapped').withArgs(unmappedToken);
		});

		it('Should simulate position closing', async function () {
			const { strategy, token, user1, owner } = await loadFixture(deployFixture);

			const tokenAddress = await token.getAddress();
			const amount = ethers.parseEther('5');
			const positionId = 1;
			const aTokenAddr = await strategy.getAToken(tokenAddress);
			expect(aTokenAddr).to.not.equal(ethers.ZeroAddress);
			await token.connect(owner).transfer(await strategy.getAddress(), amount);
			await strategy.setMockSuccessForDeposit(true);
			await strategy.testOnPositionOpened(positionId, tokenAddress, amount);
			await strategy.setMockATokenBalance(tokenAddress, amount);
			await strategy.setMockSuccessForWithdraw(true);
			const position = {
				id: positionId,
				strategyId: ethers.encodeBytes32String('STRATEGY_ID'),
				owner: user1.address,
				tokens: [tokenAddress],
				amounts: [amount],
				entryTimestamp: Math.floor(Date.now() / 1000),
				lastUpdateTimestamp: Math.floor(Date.now() / 1000),
				status: 0,
				extraData: '0x',
			};
			await expect(strategy.testOnPositionClosed(positionId, position)).to.emit(strategy, 'Withdrawn').withArgs(tokenAddress, amount, owner.address);
			const totalDeposit = await strategy.totalDeposits(tokenAddress);
			expect(totalDeposit).to.equal(0);
		});

		it('Should fail position closing with insufficient balance', async function () {
			const { strategy, token, user1 } = await loadFixture(deployFixture);

			const tokenAddress = await token.getAddress();
			const amount = ethers.parseEther('5');
			const positionId = 1;
			const position = {
				id: positionId,
				strategyId: ethers.encodeBytes32String('STRATEGY_ID'),
				owner: user1.address,
				tokens: [tokenAddress],
				amounts: [amount],
				entryTimestamp: Math.floor(Date.now() / 1000),
				lastUpdateTimestamp: Math.floor(Date.now() / 1000),
				status: 0,
				extraData: '0x',
			};
			const insufficientBalance = ethers.parseEther('3');
			await strategy.setMockATokenBalance(tokenAddress, insufficientBalance);
			await strategy.setMockSuccessForWithdraw(true);
			await expect(strategy.testOnPositionClosed(positionId, position)).to.be.revertedWithCustomError(strategy, 'InsufficientATokenBalance');
		});

		it('Should simulate position rebalancing', async function () {
			const { strategy, token, secondToken, user1, owner } = await loadFixture(deployFixture);

			const oldTokenAddress = await token.getAddress();
			const newTokenAddress = await secondToken.getAddress();
			const oldAmount = ethers.parseEther('5');
			const newAmount = ethers.parseUnits('7', 6);
			const positionId = 1;
			const oldATokenAddr = await strategy.getAToken(oldTokenAddress);
			const newATokenAddr = await strategy.getAToken(newTokenAddress);
			expect(oldATokenAddr).to.not.equal(ethers.ZeroAddress);
			expect(newATokenAddr).to.not.equal(ethers.ZeroAddress);
			await token.connect(owner).transfer(await strategy.getAddress(), oldAmount);
			await secondToken.connect(owner).transfer(await strategy.getAddress(), newAmount);

			await strategy.setMockSuccessForDeposit(true);
			await strategy.testOnPositionOpened(positionId, oldTokenAddress, oldAmount);
			await strategy.setMockATokenBalance(oldTokenAddress, oldAmount);
			await strategy.setMockSuccessForWithdraw(true);
			await strategy.setMockSuccessForDeposit(true);
			await secondToken.connect(owner).approve(await strategy.getAddress(), newAmount);
			await secondToken.connect(owner).transfer(await strategy.getAddress(), newAmount);
			const position = {
				id: positionId,
				strategyId: ethers.encodeBytes32String('STRATEGY_ID'),
				owner: user1.address,
				tokens: [oldTokenAddress],
				amounts: [oldAmount],
				entryTimestamp: Math.floor(Date.now() / 1000),
				lastUpdateTimestamp: Math.floor(Date.now() / 1000),
				status: 0,
				extraData: '0x',
			};
			const rebalanceData = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [newTokenAddress, newAmount]);
			await expect(strategy.testOnPositionRebalanced(positionId, position, rebalanceData))
				.to.emit(strategy, 'Withdrawn')
				.withArgs(oldTokenAddress, oldAmount, owner.address)
				.to.emit(strategy, 'Deposited')
				.withArgs(newTokenAddress, newAmount, owner.address);
			expect(await strategy.totalDeposits(oldTokenAddress)).to.equal(0);
			expect(await strategy.totalDeposits(newTokenAddress)).to.equal(newAmount);
		});

		it('Should fail position rebalancing when withdrawal fails', async function () {
			const { strategy, token, secondToken, user1, owner } = await loadFixture(deployFixture);

			const oldTokenAddress = await token.getAddress();
			const newTokenAddress = await secondToken.getAddress();
			const oldAmount = ethers.parseEther('5');
			const newAmount = ethers.parseUnits('7', 6);
			const positionId = 1;
			const oldATokenAddr = await strategy.getAToken(oldTokenAddress);
			const newATokenAddr = await strategy.getAToken(newTokenAddress);
			expect(oldATokenAddr).to.not.equal(ethers.ZeroAddress);
			expect(newATokenAddr).to.not.equal(ethers.ZeroAddress);
			await token.connect(owner).transfer(await strategy.getAddress(), oldAmount);
			await secondToken.connect(owner).transfer(await strategy.getAddress(), newAmount);

			await strategy.setMockSuccessForDeposit(true);
			await strategy.testOnPositionOpened(positionId, oldTokenAddress, oldAmount);
			await strategy.setMockATokenBalance(oldTokenAddress, oldAmount);
			await strategy.setMockSuccessForWithdraw(false);
			await secondToken.connect(owner).approve(await strategy.getAddress(), newAmount);
			await secondToken.connect(owner).transfer(await strategy.getAddress(), newAmount);
			const position = {
				id: positionId,
				strategyId: ethers.encodeBytes32String('STRATEGY_ID'),
				owner: user1.address,
				tokens: [oldTokenAddress],
				amounts: [oldAmount],
				entryTimestamp: Math.floor(Date.now() / 1000),
				lastUpdateTimestamp: Math.floor(Date.now() / 1000),
				status: 0,
				extraData: '0x',
			};
			const rebalanceData = ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [newTokenAddress, newAmount]);
			await strategy.testOnPositionRebalanced(positionId, position, rebalanceData);
			expect(await strategy.totalDeposits(oldTokenAddress)).to.equal(oldAmount);
		});
	});

	describe('Performance Metrics', function () {
		it('Should update TVL when requested', async function () {
			const { strategy, owner } = await loadFixture(deployFixture);

			const newTVL = ethers.parseEther('1000000');
			const newAPY = 1500;
			const newRiskScore = 30;
			await strategy.connect(owner).updatePerformanceMetrics(newTVL, newAPY, newRiskScore);

			expect(await strategy.tvl()).to.equal(newTVL);
			expect(await strategy.getAPY()).to.equal(newAPY);
			expect(await strategy.getRiskScore()).to.equal(newRiskScore);
		});

		it('Should calculate TVL correctly when deposits change', async function () {
			const { strategy, token, priceOracle, owner } = await loadFixture(deployFixture);

			const tokenAddress = await token.getAddress();
			const amount = ethers.parseEther('10');
			const MockChainlinkAggregator = await ethers.getContractFactory('MockChainlinkAggregator');
			const mockAggregator = await MockChainlinkAggregator.deploy(8, 'Mock Price Feed');
			await mockAggregator.waitForDeployment();
			await mockAggregator.setLatestAnswer(2 * 10 ** 8);
			await priceOracle.setPriceFeed(tokenAddress, await mockAggregator.getAddress());
			const aTokenAddr = await strategy.getAToken(tokenAddress);
			expect(aTokenAddr).to.not.equal(ethers.ZeroAddress);
			await strategy.mockDirectDeposit(tokenAddress, amount);
			await strategy.setMockATokenBalance(tokenAddress, amount);
			await strategy.updateTVLAndAPY();
			expect(await strategy.tvl()).to.equal(ethers.parseEther('20'));
		});

		it('Should handle aToken balance retrieval correctly', async function () {
			const { strategy, token } = await loadFixture(deployFixture);

			const tokenAddress = await token.getAddress();
			const amount = ethers.parseEther('15');
			await strategy.setMockATokenBalance(tokenAddress, amount);
			const balance = await strategy.getATokenBalance(tokenAddress);
			expect(balance).to.equal(amount);
		});
	});
});
