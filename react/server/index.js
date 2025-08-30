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
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Api-Key'],
}));

const PORT = process.env.PORT || 4000
const NITROPAY_API_BASE = process.env.NITROPAY_API_BASE
const NITROPAY_API_SECRET_KEY = process.env.NITROPAY_API_SECRET_KEY

// Zod schema provided (server uses to validate payload before sending to provider)
const IntentSchema = z.object({
  id: z.string(), // bytes32 hex
  amount: z.string().regex(/^\d+$/, "Must be a BigInt string"),
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
      amount: amount.toString(),
      token,
      status: 'pending',
      chainId: Number(chainId),
      expireAt: expireAt.toISOString()
    }
    
    // validate before send
    IntentSchema.parse(payload);
    
    const providerResp = await fetch(`${NITROPAY_API_BASE}/payment/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': NITROPAY_API_SECRET_KEY
      },
      body: JSON.stringify(payload)
    })


    if(!providerResp.ok) {
      if (providerResp.status == 401) {
        return res.status(401).json({ error: providerResp.statusText })
      } else {
        return res.status(502).json({ error: await providerResp.json() })
      }
    }

    const responseData = await providerResp.json();
    return res.json({ ...responseData })
  } catch (err) {
    return res.status(500).json({ error: 'internal_error', message: String(err) })
  }
})

app.listen(PORT, () => console.log(`Merchant server listening on ${PORT}`))
