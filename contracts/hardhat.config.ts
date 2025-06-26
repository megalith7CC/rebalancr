import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import * as dotenv from 'dotenv';

dotenv.config();

const COMPILER_SETTINGS = {
	optimizer: {
		enabled: true,
		runs: 1000000,
	},
	viaIR: true,
	metadata: {
		bytecodeHash: 'none',
	},
};

const MAINNET_RPC_URL =
	process.env.MAINNET_RPC_URL || process.env.ALCHEMY_MAINNET_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/your-api-key';
const POLYGON_MAINNET_RPC_URL = process.env.POLYGON_MAINNET_RPC_URL || 'https://polygon-mainnet.alchemyapi.io/v2/your-api-key';
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const AMOY_RPC_URL = process.env.AMOY_RPC_URL || 'https://polygon-amoy.infura.io/v3/your-api-key';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MNEMONIC = process.env.MNEMONIC || 'Your mnemonic';
const FORKING_BLOCK_NUMBER = parseInt(process.env.FORKING_BLOCK_NUMBER ?? '0', 10);

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'Your etherscan API key';
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || 'Your polygonscan API key';
const REPORT_GAS = process.env.REPORT_GAS || false;
const SNOWTRACE_API_KEY = process.env.SNOWTRACE_API_KEY || 'Your snowtrace API key';

const config = {
	solidity: {
		compilers: [
			{
				version: '0.8.28',
				settings: COMPILER_SETTINGS,
			},
			{
				version: '0.8.7',
				settings: COMPILER_SETTINGS,
			},
			{
				version: '0.8.6',
				settings: COMPILER_SETTINGS,
			},
			{
				version: '0.8.0',
				settings: COMPILER_SETTINGS,
			},
			{
				version: '0.6.12',
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
		],
	},
	networks: {
		hardhat: {
			hardfork: 'merge',
			forking: {
				url: MAINNET_RPC_URL,
				blockNumber: FORKING_BLOCK_NUMBER,
				enabled: false,
			},
			chainId: 31337,
		},
		localhost: {
			chainId: 31337,
		},
		sepolia: {
			url: SEPOLIA_RPC_URL !== undefined ? SEPOLIA_RPC_URL : '',
			accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
			chainId: 11155111,
		},
		mainnet: {
			url: MAINNET_RPC_URL,
			accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
			chainId: 1,
		},
		fuji: {
			url: process.env.AVALANCHE_FUJI_RPC_URL || '',
			accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
			chainId: 43113,
		},
		avalanche: {
			url: process.env.AVALANCHE_RPC_URL || '',
			accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
			chainId: 43114,
			gasPrice: 25000000000, 
		},
	},
	defaultNetwork: 'hardhat',
	etherscan: {
		apiKey: {
			sepolia: ETHERSCAN_API_KEY,
			mainnet: ETHERSCAN_API_KEY,
			polygon: POLYGONSCAN_API_KEY,
			polygonMumbai: POLYGONSCAN_API_KEY,
			avalancheFujiTestnet: ETHERSCAN_API_KEY || '',
			avalanche: process.env.SNOWTRACE_API_KEY || '',
		},
	},
	gasReporter: {
		enabled: Boolean(REPORT_GAS),
		currency: 'USD',
		outputFile: 'gas-report.txt',
		noColors: true,
	},
	contractSizer: {
		runOnCompile: false,
		only: [
			'APIConsumer',
			'AutomationCounter',
			'NFTFloorPriceConsumerV3',
			'PriceConsumerV3',
			'RandomNumberConsumerV2',
			'RandomNumberDirectFundingConsumerV2',
		],
	},
	paths: {
		sources: './contracts',
		tests: './test',
		cache: './cache',
		artifacts: './artifacts',
	},
	mocha: {
		timeout: 300000, 
	},
};

export default config;
