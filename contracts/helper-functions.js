import { run, network } from 'hardhat';
import { networkConfig } from './helper-hardhat-config';

const AUTO_FUND = process.env.AUTO_FUND || true;

const autoFundCheck = async (contractAddr, networkName, linkTokenAddress, additionalMessage) => {
	const chainId = network.config.chainId;
	console.log('Checking to see if contract can be auto-funded with LINK:');
	const amount = networkConfig[chainId]['fundAmount'];
	const accounts = await ethers.getSigners();
	const signer = accounts[0];
	const LinkToken = await ethers.getContractFactory('MockLinkToken');
	const linkTokenContract = new ethers.Contract(linkTokenAddress, LinkToken.interface, signer);
	const balanceBN = await linkTokenContract.balanceOf(signer.address);
	const balance = balanceBN.toString();
	const contractBalanceBN = await linkTokenContract.balanceOf(contractAddr);
	const contractBalance = await contractBalanceBN.toString();
	if (balance > amount && amount > 0 && contractBalance < amount) {
		return true;
	} else {
		console.log(
			"Account doesn't have enough LINK to fund contracts, you're deploying to a network where auto funding isn't done by default, the contract is already funded, or you set AUTO_FUND to false."
		);
		console.log(
			`Please obtain LINK via the faucet at https://faucets.chain.link/${networkName} then run the following command to fund contract with LINK:`
		);
		console.log(`yarn hardhat fund-link --contract ${contractAddr} --network ${networkName} ${additionalMessage}`);
		return false;
	}
};

const verify = async (contractAddress, args) => {
	console.log('Verifying contract...');
	try {
		await run('verify:verify', {
			address: contractAddress,
			constructorArguments: args,
		});
	} catch (e) {
		if (e.message.toLowerCase().includes('already verified')) {
			console.log('Already verified!');
		} else {
			console.log(e);
		}
	}
};

const stripHexPrefix = (hex) => {
	if (!ethers.utils.isHexString(hex)) {
		throw Error(`Expected valid hex string, got: "${hex}"`);
	}

	return hex.replace('0x', '');
};

const addHexPrefix = (hex) => {
	return hex.startsWith('0x') ? hex : `0x${hex}`;
};

const numToBytes32 = (num) => {
	const hexNum = ethers.utils.hexlify(num);
	const strippedNum = stripHexPrefix(hexNum);
	if (strippedNum.length > 32 * 2) {
		throw Error('Cannot convert number to bytes32 format, value is greater than maximum bytes32 value');
	}
	return addHexPrefix(strippedNum.padStart(32 * 2, '0'));
};

export default {
	autoFundCheck,
	verify,
	numToBytes32,
};
