import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'

// Config
const MERCHANT_SERVER = import.meta.env.VITE_MERCHANT_SERVER || 'http://localhost:4000'

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
    // load supported chains (via merchant server proxy)
    fetch(`${MERCHANT_SERVER}/payment/supported-chains`)
      .then(r => r.json())
      .then(setChains)
      .catch(err => {
        console.error('failed to fetch chains', err)
        setChains([])
      })
  }, [])

  useEffect(() => {
    if (!chainId) return setTokens([])
    fetch(`${MERCHANT_SERVER}/payment/${chainId}/supported-tokens`)
      .then(r => r.json())
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
      if (network.chainId !== Number(chainId)) {
        alert(`Connected wallet is on chain ${network.chainId}, please switch to chain ${chainId}`)
        return
      }
      setLoading(true)
      setTxStatus({ step: 'create-intent' })

      // 1) Create payment intent on merchant server
      const resp = await fetch(`${MERCHANT_SERVER}/payment/create-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          token,
          chainId: Number(chainId)
        })
      })
      const j = await resp.json()
      if (!resp.ok) throw new Error(j.error || 'create-intent failed')

      const intent = j.intent
      setTxStatus({ step: 'created', intent })

      // 2) Do approval (ERC20) then call pay on contract
      setTxStatus({ step: 'approval' })
      // use browser provider/signer
      const signer = await provider.getSigner()
      const userAddress = await signer.getAddress()

      // minimal ERC20 ABI
      const erc20Abi = [
        'function approve(address spender, uint256 amount) public returns (bool)',
        'function allowance(address owner, address spender) public view returns (uint256)'
      ]

      const vaultAddress = j.intent.vaultAddress || j.provider?.vaultAddress // fallback

      if (!vaultAddress) throw new Error('vault address missing from intent')

      const tokenContract = new ethers.Contract(token, erc20Abi, signer)
      const amountUnits = ethers.parseUnits(Number(amount).toString(), selectedTokenData?.decimals ?? 6) // default 6 for stablecoins

      const approvalTx = await tokenContract.approve(vaultAddress, amountUnits)
        setTxStatus({ step: 'approval_sent', txHash: approvalTx.hash })
        await approvalTx.wait()

      setTxStatus({ step: 'pay_tx' })
      const paymentEscrowAbi = [
        'function pay(bytes32 intentId, address token, uint256 amount) external'
      ]
      const vaultContract = new ethers.Contract(vaultAddress, paymentEscrowAbi, signer)

      // intent.id is a bytes32 hex from server
      const intentId = intent.id
      const payTx = await vaultContract.pay(intentId, token, amountUnits, { gasLimit: 600000 })
      setTxStatus({ step: 'pay_sent', txHash: payTx.hash })
      const receipt = await payTx.wait()
      setTxStatus({ step: 'succeeded', receipt })
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
