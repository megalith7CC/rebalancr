import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

describe('ChainlinkPriceOracle', function () {
	const USDC_ADDRESS = ethers.Wallet.createRandom().address;
	const WETH_ADDRESS = ethers.Wallet.createRandom().address;
	const WBTC_ADDRESS = ethers.Wallet.createRandom().address;
	const USDC_USD_PRICE = ethers.parseUnits('1.0', 8);
	const ETH_USD_PRICE = ethers.parseUnits('2000.0', 8);
	const BTC_USD_PRICE = ethers.parseUnits('40000.0', 8);

  async function deployChainlinkPriceOracleFixture() {
		const [owner, user1] = await ethers.getSigners();
		const MockChainlinkAggregator = await ethers.getContractFactory('MockChainlinkAggregator');

		const usdcUsdFeed = await MockChainlinkAggregator.deploy(8, 'USDC/USD');
		await usdcUsdFeed.updateAnswer(USDC_USD_PRICE);

		const ethUsdFeed = await MockChainlinkAggregator.deploy(8, 'ETH/USD');
		await ethUsdFeed.updateAnswer(ETH_USD_PRICE);

		const btcUsdFeed = await MockChainlinkAggregator.deploy(8, 'BTC/USD');
		await btcUsdFeed.updateAnswer(BTC_USD_PRICE);
		const ChainlinkPriceOracle = await ethers.getContractFactory('ChainlinkPriceOracle');
		const oracle = await ChainlinkPriceOracle.deploy(await usdcUsdFeed.getAddress());

		return {
			oracle,
			usdcUsdFeed,
			ethUsdFeed,
			btcUsdFeed,
			owner,
			user1,
		};
	}

	describe('Deployment', function () {
		it('Should set the right owner', async function () {
			const { oracle, owner } = await loadFixture(deployChainlinkPriceOracleFixture);
			expect(await oracle.owner()).to.equal(owner.address);
		});

		it('Should set the USD price feed', async function () {
			const { oracle, usdcUsdFeed } = await loadFixture(deployChainlinkPriceOracleFixture);
			expect(await oracle.usdPriceFeed()).to.equal(await usdcUsdFeed.getAddress());
		});

		it('Should fail to deploy with zero address USD price feed', async function () {
			const ChainlinkPriceOracle = await ethers.getContractFactory('ChainlinkPriceOracle');
			await expect(ChainlinkPriceOracle.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
				ChainlinkPriceOracle,
				'ZeroAddress'
			);
		});
	});

	describe('Price Feed Management', function () {
		it('Should set price feed correctly', async function () {
			const { oracle, ethUsdFeed } = await loadFixture(deployChainlinkPriceOracleFixture);

			await expect(oracle.setPriceFeed(WETH_ADDRESS, await ethUsdFeed.getAddress()))
				.to.emit(oracle, 'PriceFeedSet')
				.withArgs(WETH_ADDRESS, await ethUsdFeed.getAddress());

			expect(await oracle.getPriceFeed(WETH_ADDRESS)).to.equal(await ethUsdFeed.getAddress());
		});

		it('Should remove price feed correctly', async function () {
			const { oracle, ethUsdFeed } = await loadFixture(deployChainlinkPriceOracleFixture);
			await oracle.setPriceFeed(WETH_ADDRESS, await ethUsdFeed.getAddress());
			await expect(oracle.removePriceFeed(WETH_ADDRESS)).to.emit(oracle, 'PriceFeedRemoved').withArgs(WETH_ADDRESS);

			expect(await oracle.getPriceFeed(WETH_ADDRESS)).to.equal(ethers.ZeroAddress);
		});

		it('Should fail to set price feed with zero token address', async function () {
			const { oracle, ethUsdFeed } = await loadFixture(deployChainlinkPriceOracleFixture);

			await expect(oracle.setPriceFeed(ethers.ZeroAddress, await ethUsdFeed.getAddress())).to.be.revertedWithCustomError(
				oracle,
				'ZeroAddress'
			);
		});

		it('Should fail to set price feed with zero price feed address', async function () {
			const { oracle } = await loadFixture(deployChainlinkPriceOracleFixture);

			await expect(oracle.setPriceFeed(WETH_ADDRESS, ethers.ZeroAddress))
				.to.be.revertedWithCustomError(oracle, 'InvalidPriceFeed')
				.withArgs(ethers.ZeroAddress);
		});

		it('Should fail to remove non-existent price feed', async function () {
			const { oracle } = await loadFixture(deployChainlinkPriceOracleFixture);

			await expect(oracle.removePriceFeed(WETH_ADDRESS))
				.to.be.revertedWithCustomError(oracle, 'PriceFeedNotFound')
				.withArgs(WETH_ADDRESS);
		});

		it('Should fail to remove price feed with zero token address', async function () {
			const { oracle } = await loadFixture(deployChainlinkPriceOracleFixture);

			await expect(oracle.removePriceFeed(ethers.ZeroAddress)).to.be.revertedWithCustomError(oracle, 'ZeroAddress');
		});

		it('Should only allow owner to set price feeds', async function () {
			const { oracle, ethUsdFeed, user1 } = await loadFixture(deployChainlinkPriceOracleFixture);

			await expect(oracle.connect(user1).setPriceFeed(WETH_ADDRESS, await ethUsdFeed.getAddress()))
				.to.be.revertedWithCustomError(oracle, 'OwnableUnauthorizedAccount')
				.withArgs(user1.address);
		});

		it('Should only allow owner to remove price feeds', async function () {
			const { oracle, ethUsdFeed, user1 } = await loadFixture(deployChainlinkPriceOracleFixture);
			await oracle.setPriceFeed(WETH_ADDRESS, await ethUsdFeed.getAddress());
			await expect(oracle.connect(user1).removePriceFeed(WETH_ADDRESS))
				.to.be.revertedWithCustomError(oracle, 'OwnableUnauthorizedAccount')
				.withArgs(user1.address);
		});
	});

	describe('Price Retrieval', function () {
		it('Should get latest price correctly', async function () {
			const { oracle, ethUsdFeed } = await loadFixture(deployChainlinkPriceOracleFixture);
			await oracle.setPriceFeed(WETH_ADDRESS, await ethUsdFeed.getAddress());
			const price = await oracle.getLatestPrice(WETH_ADDRESS);
			const expectedPrice = ethers.parseUnits('2000.0', 18);
			expect(price).to.equal(expectedPrice);
		});

		it('Should get token price in denomination correctly', async function () {
			const { oracle, ethUsdFeed, btcUsdFeed } = await loadFixture(deployChainlinkPriceOracleFixture);
			await oracle.setPriceFeed(WETH_ADDRESS, await ethUsdFeed.getAddress());
			await oracle.setPriceFeed(WBTC_ADDRESS, await btcUsdFeed.getAddress());
			const price = await oracle.getTokenPrice(WETH_ADDRESS, WBTC_ADDRESS);
			const expectedPrice = ethers.parseUnits('0.05', 18);
			expect(price).to.equal(expectedPrice);
		});

		it('Should fail to get price for non-existent price feed', async function () {
			const { oracle } = await loadFixture(deployChainlinkPriceOracleFixture);

			await expect(oracle.getLatestPrice(WETH_ADDRESS))
				.to.be.revertedWithCustomError(oracle, 'PriceFeedNotFound')
				.withArgs(WETH_ADDRESS);
		});

		it('Should fail to get token price when token price feed not found', async function () {
			const { oracle, btcUsdFeed } = await loadFixture(deployChainlinkPriceOracleFixture);
			await oracle.setPriceFeed(WBTC_ADDRESS, await btcUsdFeed.getAddress());

			await expect(oracle.getTokenPrice(WETH_ADDRESS, WBTC_ADDRESS))
				.to.be.revertedWithCustomError(oracle, 'PriceFeedNotFound')
				.withArgs(WETH_ADDRESS);
		});

		it('Should fail to get token price when denomination price feed not found', async function () {
			const { oracle, ethUsdFeed } = await loadFixture(deployChainlinkPriceOracleFixture);
			await oracle.setPriceFeed(WETH_ADDRESS, await ethUsdFeed.getAddress());

			await expect(oracle.getTokenPrice(WETH_ADDRESS, WBTC_ADDRESS))
				.to.be.revertedWithCustomError(oracle, 'PriceFeedNotFound')
				.withArgs(WBTC_ADDRESS);
		});
	});

	describe('Price Updates', function () {
		it('Should handle price updates correctly', async function () {
			const { oracle, ethUsdFeed } = await loadFixture(deployChainlinkPriceOracleFixture);
			await oracle.setPriceFeed(WETH_ADDRESS, await ethUsdFeed.getAddress());
			const newPrice = ethers.parseUnits('2500.0', 8);
			await ethUsdFeed.updateAnswer(newPrice);
			const price = await oracle.getLatestPrice(WETH_ADDRESS);
			const expectedPrice = ethers.parseUnits('2500.0', 18);

			expect(price).to.equal(expectedPrice);
		});

		it('Should handle negative prices correctly', async function () {
			const { oracle, ethUsdFeed } = await loadFixture(deployChainlinkPriceOracleFixture);
			await oracle.setPriceFeed(WETH_ADDRESS, await ethUsdFeed.getAddress());
			const negativePrice = -ethers.parseUnits('100.0', 8);
			await ethUsdFeed.updateAnswer(negativePrice);
			await expect(oracle.getLatestPrice(WETH_ADDRESS))
				.to.be.revertedWithCustomError(oracle, 'NegativePrice')
				.withArgs(negativePrice);
		});
	});

	describe('Multiple Price Feeds', function () {
		it('Should handle multiple price feeds correctly', async function () {
			const { oracle, usdcUsdFeed, ethUsdFeed, btcUsdFeed } = await loadFixture(deployChainlinkPriceOracleFixture);
			await oracle.setPriceFeed(USDC_ADDRESS, await usdcUsdFeed.getAddress());
			await oracle.setPriceFeed(WETH_ADDRESS, await ethUsdFeed.getAddress());
			await oracle.setPriceFeed(WBTC_ADDRESS, await btcUsdFeed.getAddress());
			const usdcPrice = await oracle.getLatestPrice(USDC_ADDRESS);
			const ethPrice = await oracle.getLatestPrice(WETH_ADDRESS);
			const btcPrice = await oracle.getLatestPrice(WBTC_ADDRESS);

			expect(usdcPrice).to.equal(ethers.parseUnits('1.0', 18));
			expect(ethPrice).to.equal(ethers.parseUnits('2000.0', 18));
			expect(btcPrice).to.equal(ethers.parseUnits('40000.0', 18));
		});

		it('Should calculate cross-token prices correctly', async function () {
			const { oracle, usdcUsdFeed, ethUsdFeed, btcUsdFeed } = await loadFixture(deployChainlinkPriceOracleFixture);
			await oracle.setPriceFeed(USDC_ADDRESS, await usdcUsdFeed.getAddress());
			await oracle.setPriceFeed(WETH_ADDRESS, await ethUsdFeed.getAddress());
			await oracle.setPriceFeed(WBTC_ADDRESS, await btcUsdFeed.getAddress());
			const ethUsdcPrice = await oracle.getTokenPrice(WETH_ADDRESS, USDC_ADDRESS);
			expect(ethUsdcPrice).to.equal(ethers.parseUnits('2000.0', 18));
			const btcEthPrice = await oracle.getTokenPrice(WBTC_ADDRESS, WETH_ADDRESS);
			expect(btcEthPrice).to.equal(ethers.parseUnits('20.0', 18));
			const usdcBtcPrice = await oracle.getTokenPrice(USDC_ADDRESS, WBTC_ADDRESS);
			expect(usdcBtcPrice).to.equal(ethers.parseUnits('0.000025', 18));
		});
	});

	describe('Edge Cases', function () {
		it('Should handle very large prices correctly', async function () {
			const { oracle, ethUsdFeed } = await loadFixture(deployChainlinkPriceOracleFixture);
			await oracle.setPriceFeed(WETH_ADDRESS, await ethUsdFeed.getAddress());
			const largePrice = ethers.parseUnits('999999999.0', 8);
			await ethUsdFeed.updateAnswer(largePrice);

			const price = await oracle.getLatestPrice(WETH_ADDRESS);
			const expectedPrice = ethers.parseUnits('999999999.0', 18);

			expect(price).to.equal(expectedPrice);
		});

		it('Should handle very small prices correctly', async function () {
			const { oracle, ethUsdFeed } = await loadFixture(deployChainlinkPriceOracleFixture);
			await oracle.setPriceFeed(WETH_ADDRESS, await ethUsdFeed.getAddress());
			const smallPrice = ethers.parseUnits('0.00000001', 8);
			await ethUsdFeed.updateAnswer(smallPrice);

			const price = await oracle.getLatestPrice(WETH_ADDRESS);
			const expectedPrice = ethers.parseUnits('0.00000001', 18);

			expect(price).to.equal(expectedPrice);
		});

		it('Should handle price feeds with different decimals', async function () {
			const { oracle } = await loadFixture(deployChainlinkPriceOracleFixture);
			const MockChainlinkAggregator = await ethers.getContractFactory('MockChainlinkAggregator');
			const highDecimalFeed = await MockChainlinkAggregator.deploy(18, 'TEST/USD');
			const priceWith18Decimals = ethers.parseUnits('1000.0', 18);
			await highDecimalFeed.updateAnswer(priceWith18Decimals);
			await oracle.setPriceFeed(WETH_ADDRESS, await highDecimalFeed.getAddress());
			const price = await oracle.getLatestPrice(WETH_ADDRESS);
			expect(price).to.equal(priceWith18Decimals);
		});
	});
});
