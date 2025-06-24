import * as fs from 'fs';
import * as path from 'path';

const BASE_DIR = path.join(__dirname, '..', 'artifacts', 'contracts');

function ensureDirectoryExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function processJsonFile(filePath: string, targetDirs: string[]) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(fileContent);

    if (!jsonData.abi || !Array.isArray(jsonData.abi)) {
      console.warn(`Skipping ${filePath}: Missing or invalid ABI format.`);
      return;
    }
    
    const fileName = path.basename(filePath, '.json');
    const tsContent = `export const ${fileName}ABI = ${JSON.stringify(jsonData.abi, null, 2)} as const;\n`;

    // Export to all target directories
    targetDirs.forEach(targetDir => {
      const abiDir = path.join(targetDir, 'generated', 'abis');
      ensureDirectoryExists(abiDir);
      
      const tsFilePath = path.join(abiDir, `${fileName}.ts`);
      fs.writeFileSync(tsFilePath, tsContent, 'utf-8');
      console.log(`Exported ${fileName} ABI to: ${tsFilePath}`);
    });

  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

function walkDirectory(dir: string, targetDirs: string[]) {
  if (!fs.existsSync(dir)) {
    console.warn(`Source directory does not exist: ${dir}`);
    return;
  }

  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      walkDirectory(fullPath, targetDirs);
    } else if (/^[^.]+\.json$/.test(file)) { // Match <name>.json, ignore <name>.*.json
      processJsonFile(fullPath, targetDirs);
    }
  });
}

// Get target directories from environment variable
const exportAddresses = process.env.EXPORT_ADDRESSES ? process.env.EXPORT_ADDRESSES.split(',') : [];
const deploymentsDir = process.env.REBALANCER_DEPLOYMENTS_DIR || process.cwd();

// Default target directories if EXPORT_ADDRESSES is not set
const defaultTargets = [
  path.join(__dirname, '..', '..', 'frontend', 'generated'),
  path.join(__dirname, '..', '..', 'agent', 'generated')
];

const targetDirs = exportAddresses.length > 0 ? exportAddresses : defaultTargets;

console.log('Starting ABI export...');
console.log(`Source: ${BASE_DIR}`);
console.log(`Deployment Directory: ${deploymentsDir}`);

if (exportAddresses.length === 0) {
  console.log("No directories specified in EXPORT_ADDRESSES. Using default targets:");
  console.log(defaultTargets.join('\n'));
} else {
  console.log("Export targets from EXPORT_ADDRESSES:");
  console.log(targetDirs.join('\n'));
}

walkDirectory(BASE_DIR, targetDirs);

console.log('ABI export completed!');
