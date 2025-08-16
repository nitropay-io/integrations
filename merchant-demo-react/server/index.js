import express from 'express'
import fetch from 'node-fetch'
import dotenv from 'dotenv'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import cors from 'cors';

dotenv.config()
const app = express()

app.use(express.json())

app.use(cors({
  origin: 'http://localhost:5173', // ton frontend
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Api-Key'],
}));

const PORT = process.env.PORT || 4000
const PROVIDER_API_BASE = process.env.PROVIDER_API_BASE
const PROVIDER_API_SECRET_KEY = process.env.PROVIDER_API_SECRET_KEY

// Zod schema provided (server uses to validate payload before sending to provider)
const IntentSchema = z.object({
  id: z.string(), // bytes32 hex
  amount: z.number(),
  token: z.string().length(42).startsWith('0x'),
  status: z.enum(['pending', 'succeeded', 'failed', 'cancelled', 'expired']),
  chainId: z.number().int().positive(),
  expireAt: z.string().refine(s => !Number.isNaN(Date.parse(s)), { message: 'invalid datetime' })
})

// helper to make 32 bytes hex '0x....'
const makeBytes32 = () => '0x' + randomBytes(32).toString('hex')

// Create an intent — merchant backend calls provider backend (auth with secret)
app.post('/payment/create-intent', async (req, res) => {
  try {
    const { amount, token, chainId, expiresInMinutes = 15 } = req.body
    if (!amount || !token || !chainId) {
      return res.status(400).json({ error: 'missing params (amount, token, chainId required)' })
    }

    const intentId = makeBytes32()
    const expireAt = new Date(Date.now() + (expiresInMinutes * 60 * 1000))
    
    const payload = {
      id: intentId,
      amount: Number(amount),
      token,
      status: 'pending',
      chainId: Number(chainId),
      expireAt: expireAt.toISOString()
    }
    
    // validate before send
    IntentSchema.parse(payload);
    
    const providerResp = await fetch(`${PROVIDER_API_BASE}/payment/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': PROVIDER_API_SECRET_KEY
      },
      body: JSON.stringify(payload)
    })

    const providerJson = await providerResp.json()

    if (!providerResp.ok) {
      return res.status(502).json({ error: 'provider error', details: providerJson })
    }
    payload.vaultAddress = providerJson.vaultAddress
    // Forward provider response to client (or send our payload + provider result)
    return res.json({ intent: payload, provider: providerJson })
  } catch (err) {
    return res.status(500).json({ error: 'internal_error', message: String(err) })
  }
})

// Optional: proxy GET supported chains/tokens (if you prefer client calls directly to provider)
// Example: GET /payment/supported-chains -> proxy with public key? but we assume client will call provider directly with public key.
// For demo convenience we add proxy endpoints that forward public-key-auth GETs:
app.get('/payment/supported-chains', async (req, res) => {
  try {
    const publicKey = process.env.PROVIDER_API_PUBLIC_KEY
    const r = await fetch(`${PROVIDER_API_BASE}/payment/supported-chains`, {
      headers: { 'X-Api-Key': publicKey }
    })

    const j = await r.json()
    res.status(r.status).json(j)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'internal_error' })
  }
})

app.get('/payment/:chainId/supported-tokens', async (req, res) => {
  try {
    const publicKey = process.env.PROVIDER_API_PUBLIC_KEY
    const r = await fetch(`${PROVIDER_API_BASE}/payment/supported-tokens/${req.params.chainId}`, {
      headers: { 'X-Api-Key': publicKey }
    })
    const j = await r.json()
    res.status(r.status).json(j)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'internal_error' })
  }
})

app.listen(PORT, () => console.log(`Merchant server listening on ${PORT}`))
