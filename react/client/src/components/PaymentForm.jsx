// src/components/PaymentForm.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { NitroPaySDK } from "@nitropay-io/sdk";
import * as Select from "@radix-ui/react-select";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { CheckIcon } from "@radix-ui/react-icons";

// Config
const MERCHANT_SERVER = import.meta.env.VITE_MERCHANT_SERVER || "http://localhost:4000";
const PUBLIC_API_KEY = import.meta.env.VITE_NITROPAY_PUBLIC_KEY || "";

const sdk = new NitroPaySDK({
  publicKey: PUBLIC_API_KEY,
  evmProvider: window.ethereum,
});

export default function PaymentForm({ total }) {

  const [chains, setChains] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [chainId, setChainId] = useState(undefined);
  const [token, setToken] = useState("");
  const [selectedTokenData, setSelectedTokenData] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState(undefined);
  const [walletAddress, setWalletAddress] = useState(undefined);

  if (!window.ethereum) return <p>Please install MetaMask</p>;

  // Load chains
  useEffect(() => {
    sdk
      .getSupportedChains()
      .then((supportedChains) => setChains(supportedChains))
      .catch(() => {
        setChains([]);
        setTokens([]);
      });
  }, []);

  useEffect(() => {
    if (!chainId || chains.length < 1) return setTokens([]);
    const chain = chains.find((c) => c.networkId == chainId);
    if (chain) setTokens(chain.tokens);
  }, [chainId, chains]);

  const isValidAmount = () => {
    const n = Number(total);
    return !Number.isNaN(n) && n > 0;
  };

  const canPay = chainId && token && isValidAmount() && walletAddress && !loading;

  async function connectWallet() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    setWalletAddress(address);
  }

  async function handlePay() {
    if (!canPay) {
      console.log(chainId,token,isValidAmount(),walletAddress,loading);
      return;
    }
    try {
      setLoading(true);
      setTxStatus({ step: "create-intent" });

      const amountInWei = ethers.parseUnits(total.toString(), selectedTokenData.decimals);
      const body = { amount: amountInWei.toString(), token, chainId: Number(chainId) };

      const resp = await fetch(`${MERCHANT_SERVER}/payment/create-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) throw new Error("create-intent failed");

      setTxStatus({ step: "approve_and_pay" });
      const intent = await resp.json();
      const { intentId, vaultAddress, amount: intentAmount } = intent;

      const receipt = await sdk.pay({
        intentId,
        chainId,
        vaultAddress,
        tokenAddress: token,
        amount: BigInt(intentAmount),
      });

      setTxStatus({ step: "payment_sent", txStatus: receipt.transactionHash });
    } catch (err) {
      setTxStatus({ step: "error", error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Payment</h2>

      <button
        onClick={connectWallet}
        className="mb-4 w-full lg:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
      >
        {walletAddress ? `Connected: ${walletAddress.slice(0, 6)}...` : "Connect Wallet"}
      </button>

      {/* Select chain */}
      <div className="mb-4">
        <label className="block text-sm mb-1">Chain</label>
        <Select.Root value={chainId} onValueChange={setChainId}>
          <Select.Trigger className="w-full border rounded-lg px-3 py-2 text-left">
            <Select.Value placeholder="Select chain"/>
          </Select.Trigger>
          <Select.Content className="bg-white border rounded-lg shadow-md">
            {chains.map((c) => (
              <Select.Item 
                key={c.networkId} 
                value={c.networkId.toString()} 
                className="px-3 py-2 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <Select.ItemText>
                    {c.name} ({c.networkId})
                  </Select.ItemText>
                  {c.tokens.map((t) => (
                    <img
                      src={t.logoUrl}
                      alt={t.symbol}
                      className="w-5 h-5 rounded-full"
                    />
                  ))}
                </div>
                <Select.ItemIndicator>
                  <CheckIcon />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </div>

      {/* Token radios */}
      <div className="mb-4">
        <label className="block text-sm mb-1">Token</label>
        <RadioGroup.Root
          value={token}
          onValueChange={(val) => {
            setToken(val);
            const t = tokens.find((tk) => tk.address === val);
            setSelectedTokenData(t);
          }}
          className="flex flex-wrap gap-2"
        >
          {tokens.map((t) => (
            <RadioGroup.Item
            key={t.address}
            value={t.address}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer data-[state=checked]:bg-indigo-200"
            >
              <img
                src={t.logoUrl}
                alt={t.symbol}
                className="w-5 h-5 rounded-full"
              />
              <span className="font-medium">{t.symbol}</span>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </div>

      {/* Amount */}
      <div className="mb-4">
        <label className="block text-sm mb-1">Amount</label>
        <input
          value={total}
          readOnly
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      {/* Pay button */}
      <button
        onClick={handlePay}
        
        className={`w-full py-2 rounded-lg ${loading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700 text-white"}`}
      >
        {loading ? "Processing..." : "Pay"}
      </button>

      {/* Status */}
      <div className="mt-4 text-sm">
        <strong>Status:</strong>
        <pre className="bg-gray-100 p-2 rounded">{JSON.stringify(txStatus, null, 2)}</pre>
      </div>
    </div>
  );
}
