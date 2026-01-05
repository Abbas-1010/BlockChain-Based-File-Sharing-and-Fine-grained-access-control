// frontend/src/contract.js
import { ethers } from "ethers";
import contractData from "../abis/FileStorage.json"; // ensure this path exists
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export function getProvider() {
  if (typeof window.ethereum !== "undefined") {
    return new ethers.providers.Web3Provider(window.ethereum);
  }
  // fallback to localhost provider if metamask not available (used for read-only)
  return new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
}

export async function getSigner() {
  const provider = getProvider();
  // request accounts if metamask available
  if (provider.send) {
    try {
      await provider.send("eth_requestAccounts", []);
    } catch (e) {
      // user denied
      console.warn("User did not allow accounts:", e);
    }
  }
  return provider.getSigner();
}

// returns contract connected to signer for write operations
export async function getContract() {
  const signer = await getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, contractData.abi, signer);
}

// returns a read-only contract (provider)
export function getReadOnlyContract() {
  const provider = getProvider();
  return new ethers.Contract(CONTRACT_ADDRESS, contractData.abi, provider);
}