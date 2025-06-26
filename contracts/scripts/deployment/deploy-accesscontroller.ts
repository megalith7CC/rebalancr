import { ethers, network, run } from 'hardhat';
import { developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } from '../../helper-hardhat-config';
import { DeploymentManager } from './DeploymentManager';


async function DeployAccessController(chainId: any) {
	const sanitize_key = (key: string) => {
		let privateKey = key;
		if (!privateKey?.startsWith('0x')) {
			privateKey = '0x' + privateKey;
		}
		return privateKey;
	};

	let admin;

	if (developmentChains.includes(network.name)) {
		const [deployer] = await ethers.getSigners();
		admin = deployer.address;
	} else {
		const wallet = new ethers.Wallet(sanitize_key(process.env.PRIVATE_KEY || ''), ethers.provider);
		admin = wallet.address;
	}

	const AccessController = await ethers.getContractFactory('AccessController');
	const accessController = await AccessController.deploy(admin);

	const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS;
	await accessController.deploymentTransaction()?.wait(waitBlockConfirmations);

	const address = await accessController.getAddress();

	DeploymentManager.saveAddress('AccessController', address);

	if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
		await run('verify:verify', {
			address: address,
			constructorArguments: [admin],
		});
	}

	return address;
}

export { DeployAccessController };
