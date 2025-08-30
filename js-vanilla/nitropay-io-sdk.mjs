// src/sdk.ts
import {
  createPublicClient,
  createWalletClient,
  custom,
  http
} from "viem";

// src/apiClient.ts
import axios from "axios";
function apiClient(baseUrl, apiKey) {
  console.log("withcredentials");
  const instance = axios.create({
    baseURL: baseUrl,
    withCredentials: true,
    headers: {
      "X-Api-Key": apiKey
    }
  });
  return instance;
}

// src/abi/approveAbi.ts
var approveAbi = [
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
    stateMutability: "nonpayable"
  }
];

// src/abi/paymentEscrowAbi.ts
var paymentEscrowAbi = [
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "intentId",
        type: "bytes32"
      },
      {
        internalType: "address",
        name: "token",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256"
      }
    ],
    name: "pay",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];

// src/utils.ts
import * as viemChains from "viem/chains";
function isChain(candidate) {
  return typeof candidate === "object" && candidate !== null && // propriété minimale commune à toutes les Chain de viem
  typeof candidate.id === "number" && typeof candidate.name === "string";
}
function getAllChains() {
  return Object.values(viemChains).filter(isChain);
}
function getChainById(chainId) {
  chainId = Number(chainId);
  const allChains = getAllChains();
  const found = allChains.find((c) => c.id === chainId);
  if (!found)
    throw new Error(`Unsupported chainId: ${chainId}`);
  return found;
}

// src/sdk.ts
var NITROPAY_API_URL = "https://api.nitropay.io";
var NitroPaySDK = class {
  apiClient;
  evmProvider;
  constructor({
    evmProvider,
    publicKey
  }) {
    this.evmProvider = evmProvider;
    this.apiClient = apiClient(NITROPAY_API_URL, publicKey);
  }
  async isConnected() {
    try {
      const connectedAccounts = await this.evmProvider.request({
        method: "eth_accounts"
      });
      if (!connectedAccounts || connectedAccounts.length === 0) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
  async getNetwork() {
    try {
      const currentChainId = await this.evmProvider.request({
        method: "eth_chainId"
      });
      return parseInt(currentChainId, 16);
    } catch {
      return null;
    }
  }
  async pay({
    intentId,
    chainId,
    vaultAddress,
    tokenAddress,
    amount
  }) {
    if (!await this.isConnected()) {
      throw new Error("Wallet not connected");
    }
    if (await this.getNetwork() !== Number(chainId)) {
      console.log(await this.getNetwork());
      console.log(chainId);
      throw new Error(`Wrong network, please switch to network ${chainId}`);
    }
    const accounts = await this.evmProvider.request({
      method: "eth_requestAccounts"
    });
    const account = accounts[0];
    const chain = getChainById(chainId);
    const publicClient = createPublicClient({
      chain,
      transport: http()
    });
    const walletClient = createWalletClient({
      account,
      chain,
      transport: custom(this.evmProvider)
    });
    const approveTx = await walletClient.writeContract({
      chain,
      address: tokenAddress,
      abi: approveAbi,
      functionName: "approve",
      args: [vaultAddress, amount]
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    const payHash = await walletClient.writeContract({
      address: vaultAddress,
      abi: paymentEscrowAbi,
      functionName: "pay",
      args: [intentId, tokenAddress, amount]
    });
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: payHash
    });
    return receipt;
  }
  async getSupportedChains() {
    const res = await this.apiClient.get("/payment/supported-chains");
    return res.data;
  }
  async getSupportedTokens(chainId) {
    const res = await this.apiClient.get(
      `/payment/${chainId}/supported-tokens`
    );
    return res.data;
  }
};
export {
  NitroPaySDK
};
