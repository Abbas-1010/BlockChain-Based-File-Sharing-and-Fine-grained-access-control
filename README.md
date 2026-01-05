# BlockChain-Based-File-Sharing-and-Fine-grained-access-control

1. System Requirements
  • Node.js (v18 or above)
  • MetaMask Browser Extension
  • IPFS Desktop or Kubo (go-ipfs)
  • Git (optional)
2. Project Structure
  Project/
    Backend (Hardhat + Solidity)
    frontend (React + Vite)
3. Backend Setup (Hardhat)
  Step 1: Navigate to Backend folder
    cd Backend
  Step 2: Install dependencies
    npm install
  Step 3: Start local blockchain
    npx hardhat node
  Step 4: Deploy smart contract (new terminal)
    npx hardhat run scripts/deploy.js --network localhost
    Copy the deployed contract address.
4. Frontend Setup
  Step 1: Navigate to frontend folder
    cd frontend
  Step 2: Install dependencies
    npm install
  Step 3: Create .env file and add contract address
    VITE_CONTRACT_ADDRESS=your_deployed_contract_address
  Step 4: Start frontend
    npm run dev
5. MetaMask Configuration
  Add Hardhat Local Network:
  Network Name: Hardhat Local
  RPC URL: http://127.0.0.1:8545
  Chain ID: 31337
  Currency: ETH
  Import accounts using private keys shown in Hardhat node terminal.
6. Running the Project
  • Login using wallet address
  • Upload and register files
  • View My Files, Public Files, Shared Files
• Request, approve or revoke access
• View access logs
