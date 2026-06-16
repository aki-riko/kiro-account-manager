import { createContext, useContext, useState, useMemo, ReactNode } from 'react'
import { formatGatewayAccountOptionLabel } from '../gatewayPageUtils'

interface GatewayDataContextValue {
  // State
  accounts: any[]
  groups: any[]
  logDir: string
  loading: boolean
  saving: boolean
  copySuccess: string

  // Computed
  accountOptions: Array<{ value: string; label: string }>
  groupOptions: Array<{ value: string; label: string }>

  // Actions
  setAccounts: (accounts: any[]) => void
  setGroups: (groups: any[]) => void
  setLogDir: (dir: string) => void
  setLoading: (loading: boolean) => void
  setSaving: (saving: boolean) => void
  setCopySuccess: (msg: string) => void
}

export const GatewayDataContext = createContext<GatewayDataContextValue | null>(null)

export function useGatewayData() {
  const context = useContext(GatewayDataContext)
  if (!context) {
    throw new Error('useGatewayData must be used within GatewayDataProvider')
  }
  return context
}

export function GatewayDataProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [logDir, setLogDir] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copySuccess, setCopySuccess] = useState('')

  const accountOptions = useMemo(
    () => accounts
      .filter(account => account.enabled !== false)
      .map(account => ({
        value: account.id,
        label: formatGatewayAccountOptionLabel(account),
        account,
      })),
    [accounts]
  )

  const groupOptions = useMemo(
    () => groups.map(group => ({ value: group.id, label: group.name })),
    [groups]
  )

  const value = useMemo(() => ({
    accounts,
    groups,
    logDir,
    loading,
    saving,
    copySuccess,
    accountOptions,
    groupOptions,
    setAccounts,
    setGroups,
    setLogDir,
    setLoading,
    setSaving,
    setCopySuccess,
  }), [
    accounts,
    groups,
    logDir,
    loading,
    saving,
    copySuccess,
    accountOptions,
    groupOptions,
  ])

  return (
    <GatewayDataContext.Provider value={value}>
      {children}
    </GatewayDataContext.Provider>
  )
}
