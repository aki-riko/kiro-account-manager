import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encode, decode } from 'cbor-x'

const KIRO_WEB_PORTAL = 'https://app.kiro.dev'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { accessToken, idp } = req.body
  
  if (!accessToken || !idp) {
    return res.status(400).json({ error: 'Missing required fields: accessToken, idp' })
  }

  try {
    const url = `${KIRO_WEB_PORTAL}/service/KiroWebPortalService/operation/GetUserUsageAndLimits`
    const cookie = `Idp=${idp}; AccessToken=${accessToken}`
    const body = encode({ isEmailRequired: true, origin: 'KIRO_IDE' })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/cbor',
        'Accept': 'application/cbor',
        'smithy-protocol': 'rpc-v2-cbor',
        'authorization': `Bearer ${accessToken}`,
        'Cookie': cookie
      },
      body
    })

    const bytes = new Uint8Array(await response.arrayBuffer())
    
    if (!response.ok) {
      let errorMsg: string
      try {
        errorMsg = JSON.stringify(decode(bytes))
      } catch {
        errorMsg = new TextDecoder().decode(bytes)
      }
      
      const isBannedStatus = response.status === 403 || response.status === 423
      const isBannedMsg = errorMsg.includes('AccountSuspendedException') || errorMsg.includes('TEMPORARILY_SUSPENDED')
      if (isBannedStatus && isBannedMsg) {
        return res.status(403).json({ error: 'BANNED', message: errorMsg })
      }
      return res.status(response.status).json({ error: errorMsg })
    }

    return res.status(200).json(decode(bytes))
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
