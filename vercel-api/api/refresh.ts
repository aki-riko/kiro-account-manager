import type { VercelRequest, VercelResponse } from '@vercel/node'

const KIRO_AUTH_ENDPOINT = 'https://prod.us-east-1.auth.desktop.kiro.dev'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { refreshToken, machineId } = req.body
  
  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing required field: refreshToken' })
  }

  const userAgent = `KiroIDE-0.6.18-${machineId || 'unknown'}`

  try {
    const response = await fetch(`${KIRO_AUTH_ENDPOINT}/refreshToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent
      },
      body: JSON.stringify({ refreshToken })
    })

    const data = await response.json()
    
    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
