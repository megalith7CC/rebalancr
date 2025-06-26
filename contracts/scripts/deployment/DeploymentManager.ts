import { writeFileSync, readFileSync, existsSync } from 'fs';
import path, { join } from 'path';
import fs from 'fs';
import { network } from 'hardhat';

interface DeploymentAddresses {
	[contractName: string]: string;
}

interface NetworkDeployments {
	[chainId: string]: DeploymentAddresses;
}

const EXPORT_ADDRESSES = process.env.EXPORT_ADDRESSES ? process.env.EXPORT_ADDRESSES.split(',') : [];
const DEPLOYMENTS_FILES = join(__dirname, '../../deployments.json');

type DeploymentInfo = {
	network?: string;
	chainId?: string;
	timestamp?: string;
	deployer?: string;
	contracts?: Record<string, string>;
	external?: Record<string, string>;
} | null;

export class DeploymentManager {
	private static deployments: NetworkDeployments = {};

	static {
		this.loadDeployments();
	}

	private static loadDeployments(): void {
		if (existsSync(DEPLOYMENTS_FILES)) {
			try {
				const data = readFileSync(DEPLOYMENTS_FILES, 'utf8');
				this.deployments = JSON.parse(data);
			} catch (error) {
				console.warn('Failed to load deployments file:', error);
				this.deployments = {};
			}
		}
	}

	private static saveDeployments(): void {
		try {
			writeFileSync(DEPLOYMENTS_FILES, JSON.stringify(this.deployments, null, 2));
		} catch (error) {
			console.error('Failed to save deployments:', error);
		}
	}

	static saveAddress(contractName: string, address: string): void {
		const chainId = network.config.chainId?.toString() || 'unknown';

		if (!this.deployments[chainId]) {
			this.deployments[chainId] = {};
		}

		this.deployments[chainId][contractName] = address;
		this.saveDeployments();

		console.log(`Saved ${contractName}: ${address} for chain ${chainId}`);
	}

	static getAddress(contractName: string, chainIdOverride?: string): string | undefined {
		const chainId = chainIdOverride || network.config.chainId?.toString() || 'unknown';
		return this.deployments[chainId]?.[contractName];
	}

	static getAllAddresses(chainIdOverride?: string): DeploymentAddresses {
		const chainId = chainIdOverride || network.config.chainId?.toString() || 'unknown';
		return this.deployments[chainId] || {};
	}

	static hasAddress(contractName: string, chainIdOverride?: string): boolean {
		return !!this.getAddress(contractName, chainIdOverride);
	}

	static getNetworkName(): string {
		return network.name;
	}

	static getChainId(): number {
		return network.config.chainId || 31337;
	}

	static ExportDeploymentInfo(deploymentInfo: DeploymentInfo) {
		if (!deploymentInfo) {
			return;
		}

		console.log('\nDeployment Summary:');
		console.log('======================');
		console.log('Network:', deploymentInfo.network);
		console.log('Chain ID:', deploymentInfo.chainId);
		console.log('Deployer:', deploymentInfo.deployer);
		console.log('\nContract Addresses:');
		Object.entries(deploymentInfo?.contracts || {}).forEach(([name, address]) => {
			console.log(`${name}: ${address}`);
		});
		console.log('\nExternal Contracts:');
		Object.entries(deploymentInfo?.external || {}).forEach(([name, address]) => {
			console.log(`${name}: ${address}`);
		});

		const content = `// Auto-generated deployment configuration

export const addresses = ${JSON.stringify(deploymentInfo.contracts, null, 2)};

export const externalAddresses = ${JSON.stringify(deploymentInfo.external, null, 2)};

export const deploymentConfig = ${JSON.stringify(deploymentInfo, null, 2)};
`;

		const locations = process.env.EXPORT_ADDRESSES ? process.env.EXPORT_ADDRESSES.split(',') : [];

		console.log('\nSaving deployment info to directories:');
		if (locations.length === 0) {
			console.log('No directories specified in EXPORT_ADDRESSES. Saving to default locations.');
			locations.push('../agent', '../frontend');
		}

		locations.forEach((location: string) => {
			try {
				const fullPath = path.resolve(location);
				const srcPath = path.join(fullPath, 'generated');

				if (!fs.existsSync(srcPath)) {
					fs.mkdirSync(srcPath, { recursive: true });
				}

				const addressesPath = path.join(srcPath, 'addresses.ts');
				writeFileSync(addressesPath, content);
				console.log(`Saved to: ${addressesPath}`);
			} catch (error: any) {
				console.error(`❌ Failed to save to ${location}:`, error.message);
			}
		});
	}

	static ExportAddresses(): void {
		const chainId = network.config.chainId?.toString() || 'unknown';
		const addresses = this.getAllAddresses();

		const info: DeploymentInfo = {
			chainId,
			contracts: addresses,
            network: network.name,
            deployer: network.config.from || 'unknown',
			external: {}, 
			timestamp: new Date().toISOString(),
		};

		this.ExportDeploymentInfo(info);
	}





}
