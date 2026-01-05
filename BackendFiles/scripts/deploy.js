const hre = require("hardhat");

async function main() {
  // Compile if not already compiled
  await hre.run("compile");

  // Deploy contract
  const FileStorage = await hre.ethers.getContractFactory("FileStorage");
  const fileStorage = await FileStorage.deploy();

  // Wait for deployment
  await fileStorage.waitForDeployment();

  // Get contract address
  const address = await fileStorage.getAddress();
  console.log("✅ FileStorage deployed to:", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });