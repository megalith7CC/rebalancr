type NetworkConfig = {
	[key: string]: {
		name?: string;
		ethUsdPriceFeed?: string;
		fee?: string;
		keyHash?: string;
		jobId?: string;
		fundAmount?: string;
		automationUpdateInterval?: string;
		linkToken?: string;
		vrfCoordinator?: string;
		vrfWrapper?: string;
		oracle?: string;
		functionsRouter?: string;
		usdPriceFeed?: string;
		automationRegistry?: string;
		aavePoolAddress?: string;
		aTokenAddress?: {
			[token: string]: string;
		};
		tokenAddress?: {
			[token: string]: string;
		};
	};
};

const networkConfig: NetworkConfig = {
	default: {
		name: 'hardhat',
		fee: '100000000000000000',
		keyHash: '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc',
		jobId: '29fa9aa13bf1468788b7cc4a500a45b8',
		fundAmount: '1000000000000000000',
		automationUpdateInterval: '30',
	},
	31337: {
		name: 'localhost',
		fee: '100000000000000000',
		keyHash: '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc',
		jobId: '29fa9aa13bf1468788b7cc4a500a45b8',
		fundAmount: '1000000000000000000',
		automationUpdateInterval: '30',
		ethUsdPriceFeed: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
		tokenAddress: {
			USDC: '0x3B3DC46390ED1A70Ca74CC6Ff638a69C88002AAF', 
			USDT: '0x41F1A9BAFC7535a3eC2addE7a023ed51C7cb84B5', 
			DAI: '0x8966B964cC74D63Bb6056E0CAC1995F6136DC4f2', 
		},
		aTokenAddress: {
			USDC: '0x239f8bB67ad12bE23e2C765C90DF66e4B0D994E4', 
			USDT: '0x6938d4006aDE206195cC13ee1bc54b3571E8c113', 
			DAI: '0x185A0A95235C16dB2849DFD55Fa2f1183f84f85A', 
		},
	},
	1: {
		name: 'mainnet',
		linkToken: '0x514910771af9ca656af840dff83e8264ecf986ca',
		fundAmount: '0',
		automationUpdateInterval: '30',
	},
	11155111: {
		name: 'sepolia',
		linkToken: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
		ethUsdPriceFeed: '0x694AA1769357215DE4FAC081bf1f309aDC325306',
		keyHash: '0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae',
		vrfCoordinator: '0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B',
		vrfWrapper: '0x195f15F2d49d693cE265b4fB0fdDbE15b1850Cc1',
		oracle: '0x6090149792dAAeE9D1D568c9f9a6F6B46AA29eFD',
		jobId: 'ca98366cc7314957b8c012c72f05aeeb',
		fee: '100000000000000000',
		fundAmount: '10000000000000000000', 
		automationUpdateInterval: '30',
	},
	137: {
		name: 'polygon',
		linkToken: '0xb0897686c545045afc77cf20ec7a532e3120e0f1',
		ethUsdPriceFeed: '0xF9680D99D6C9589e2a93a78A04A279e509205945',
		oracle: '0x0a31078cd57d23bf9e8e8f1ba78356ca2090569e',
		jobId: '12b86114fa9e46bab3ca436f88e1a912',
		fee: '100000000000000',
		fundAmount: '100000000000000',
	},
	80002: {
		name: 'amoy',
		linkToken: '0x0fd9e8d3af1aaee056eb9e802c3a762a667b1904',
		ethUsdPriceFeed: '0xF0d50568e3A7e8259E16663972b11910F89BD8e7',
		keyHash: '0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899',
		vrfCoordinator: '0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2',
		vrfWrapper: '0x6e6c366a1cd1F92ba87Fd6f96F743B0e6c967Bf0',
		oracle: '0x40193c8518BB267228Fc409a613bDbD8eC5a97b3',
		jobId: 'ca98366cc7314957b8c012c72f05aeeb',
		fee: '100000000000000000',
		fundAmount: '100000000000000000', 
		automationUpdateInterval: '30',
	},
	43113: {
		name: 'fuji',
		linkToken: '0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846',
		usdPriceFeed: '0x0A77230d17318075983913bC2145DB16C7366156',
		keyHash: '0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4',
		vrfCoordinator: '0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D',
		vrfWrapper: '0x708701a1DfF4f478de54383E49a627eD4852C816',
		automationRegistry: '0x02777053d6764996e594c3E88AF1D58D5363a2e6',
		functionsRouter: '0x1cA9A3e7D5F6bF6C8a1e2e5e9bD2f1a6C4f4D7f8',
		oracle: '0x0bDDCD124709aCBf9BB3F824EbC61C87019888bb',
		jobId: '29fa9aa13bf1468788b7cc4a500a45b8',
		fee: '100000000000000000',
		fundAmount: '1000000000000000000',
		ethUsdPriceFeed: '0x86d67c3D38D2bCeE722E601025C25a575021c6EA',
		automationUpdateInterval: '30',
		aavePoolAddress: '0x76cc67FF2CC77821A70ED14321111Ce381C2594D',
		aTokenAddress: {
			USDC: '0x57F1c63497AEe0bE305B8852b354CEc793da43bB', 
			USDT: '0x532E6537FEA298397212F09A61e03311686f548e', 
			DAI: '0x211Cc4DD073734dA055fbF44a2b4667d5E5fE5d2', 
		},
		tokenAddress: {
			USDC: '0x5425890298aed601595a70AB815c96711a31Bc65', 
			USDT: '0xb452b513552aa0B57c4b1C9372eFEa78024e5936', 
			DAI: '0x51BC2DfB9D12d9dB50C855A5330fBA0faF761D15', 
		},
	},
	43114: {
		name: 'avalanche',
		linkToken: '0x5947BB275c521040051D82396192181b413227A3',
		usdPriceFeed: '0x0A77230d17318075983913bC2145DB16C7366156',
		keyHash: '0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4',
		vrfCoordinator: '0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D',
		vrfWrapper: '0x708701a1DfF4f478de54383E49a627eD4852C816',
		automationRegistry: '0x02777053d6764996e594c3E88AF1D58D5363a2e6',
		functionsRouter: '0x1cA9A3e7D5F6bF6C8a1e2e5e9bD2f1a6C4f4D7f8',
		oracle: '0x0bDDCD124709aCBf9BB3F824EbC61C87019888bb',
		jobId: '29fa9aa13bf1468788b7cc4a500a45b8',
		fee: '100000000000000000',
		fundAmount: '1000000000000000000',
		automationUpdateInterval: '30',
	},
};

const developmentChains = ['hardhat', 'localhost'];
const VERIFICATION_BLOCK_CONFIRMATIONS = 6;

export { networkConfig, developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS };
