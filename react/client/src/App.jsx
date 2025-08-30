import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'

import { NitroPaySDK } from '@nitropay-io/sdk';

// Config
const MERCHANT_SERVER = import.meta.env.VITE_MERCHANT_SERVER || 'http://localhost:4000'
const PUBLIC_API_KEY = import.meta.env.VITE_NITROPAY_PUBLIC_KEY || ''

const sdk = new NitroPaySDK({
  publicKey: PUBLIC_API_KEY,
  evmProvider: window.ethereum
})

export default function App() {
  const [chains, setChains] = useState([])
  const [tokens, setTokens] = useState([])
  const [chainId, setChainId] = useState('')
  const [token, setToken] = useState('')
  const [selectedTokenData, setSelectedTokenData] = useState(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [txStatus, setTxStatus] = useState(null)
  const [walletAddress, setWalletAddress] = useState(null)

  useEffect(() => {
    sdk.getSupportedChains()
    .then(result => {
      return result
    })
    .then(setChains)
    .catch(err => {
      console.error('failed to fetch chains', err)
      setChains([])
    });
  }, [])

  useEffect(() => {
    if (!chainId) return setTokens([])

    sdk.getSupportedTokens(chainId)
    .then(result => {
      return result
    })
    .then(setTokens)
    .catch(err => {
      console.error('failed to fetch tokens', err)
      setTokens([])
    })
  }, [chainId])

  // helper validate amount
  const isValidAmount = () => {
    const n = Number(amount)
    return !Number.isNaN(n) && n > 0
  }

  const canPay = chainId && token && isValidAmount() && walletAddress && !loading

  // connect wallet (simple)
  async function connectWallet() {
    if (!window.ethereum) return alert('Please install MetaMask')
    const provider = new ethers.BrowserProvider(window.ethereum)                      
    await provider.send('eth_requestAccounts', [])
    const signer = await provider.getSigner()
    const address = await signer.getAddress()
    setWalletAddress(address)
  }

  // main pay flow
  async function handlePay() {
    if (!canPay) return

    try {
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const network = await provider.getNetwork()
      if (Number(network.chainId) !== Number(chainId)) {
        alert(`Connected wallet is on chain ${network.chainId}, please switch to chain ${chainId}`)
        return
      }

      setLoading(true)
      setTxStatus({ step: 'create-intent' })

      const amountInWei = ethers.parseUnits(amount.toString(), selectedTokenData.decimals)
      const body = {
        amount: amountInWei,
        token,
        chainId: Number(chainId)
      };
      const resp = await fetch(`${MERCHANT_SERVER}/payment/create-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInWei.toString(),
          token,
          chainId: Number(chainId)
        })
      })
      if (!resp.ok) throw new Error(resp.error || 'create-intent failed')
      
      setTxStatus({ step: 'approve_and_pay' })

      const intent = await resp.json()
      const { intentId, vaultAddress, amount:intentAmount } = intent;
      
      const receipt = await sdk.pay({
        intentId,
        chainId,
        vaultAddress,
        tokenAddress: token,
        amount: BigInt(intentAmount)
      });

      setLoading(false)
      setTxStatus({ step: 'payment_sent', txStatus: receipt.transactionHash })
    } catch (err) {
      setTxStatus({ step: 'error', error: String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>Merchant Payment Demo</h1>

      <div style={{ marginBottom: 12 }}>
        <button onClick={connectWallet}>{walletAddress ? `Connected ${walletAddress}` : 'Connect Wallet'}</button>
      </div>

      <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
        <div style={{ marginBottom: 8 }}>
          <label>Chain</label><br />
          <select value={chainId} onChange={e => setChainId(e.target.value)}>
            <option value="">-- choose chain --</option>
            {chains.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label>Token</label>
          <div className="radio-row">
            {tokens.length === 0 ? <em>Select chain</em> : tokens.map(t => (
              <label key={t.tokenAddress}>
                <input 
                  type="radio" 
                  name="token" 
                  checked={token === t.tokenAddress} 
                  onChange={() => {
                    setToken(t.tokenAddress)
                    setSelectedTokenData(t)
                  }}
                />
                {t.symbol} ({t.tokenAddress})
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label>Amount</label><br />
          <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 1.5" />
        </div>

        <div>
          <button onClick={handlePay} disabled={!canPay} className={loading ? 'loading' : ''}>
            {loading ? 'Processing...' : 'Pay'}
          </button>
        </div>

        <div className="status">
          <strong>Status:</strong>
          <pre>{JSON.stringify(txStatus, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
