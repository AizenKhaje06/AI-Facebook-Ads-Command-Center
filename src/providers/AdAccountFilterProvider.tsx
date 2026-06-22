'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type BusinessManager = {
  id: string
  business_manager_id: string
  name: string
}

type AdAccount = {
  id: string
  ad_account_id: string
  name: string
  business_manager_id: string | null
}

type FilterContextType = {
  // Selected values
  selectedBusinessManagerId: string | null
  selectedAdAccountId: string | null
  
  // Available options
  businessManagers: BusinessManager[]
  adAccounts: AdAccount[]
  
  // Filtered ad accounts (based on BM selection)
  filteredAdAccounts: AdAccount[]
  
  // Actions
  setSelectedBusinessManager: (id: string | null) => void
  setSelectedAdAccount: (id: string | null) => void
  refreshData: () => Promise<void>
  
  // Loading states
  loading: boolean
  error: string | null
}

const AdAccountFilterContext = createContext<FilterContextType | undefined>(undefined)

export function AdAccountFilterProvider({ 
  children,
  workspaceId 
}: { 
  children: ReactNode
  workspaceId: string 
}) {
  const [selectedBusinessManagerId, setSelectedBusinessManagerId] = useState<string | null>(null)
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string | null>(null)
  
  const [businessManagers, setBusinessManagers] = useState<BusinessManager[]>([])
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter ad accounts based on selected BM
  // If BM selected: show linked accounts
  // If no BM selected: show all accounts
  const filteredAdAccounts = selectedBusinessManagerId
    ? adAccounts.filter(acc => acc.business_manager_id === selectedBusinessManagerId)
    : adAccounts

  // Load data from API
  const refreshData = async () => {
    if (!workspaceId) return
    
    setLoading(true)
    setError(null)

    try {
      // Fetch business managers
      const bmResponse = await fetch(`/api/meta/business-managers?workspace_id=${workspaceId}`)
      const bmData = await bmResponse.json()
      
      if (bmResponse.ok) {
        setBusinessManagers(bmData.data || [])
      }

      // Fetch ad accounts
      const accResponse = await fetch(`/api/meta/ad-accounts?workspace_id=${workspaceId}`)
      const accData = await accResponse.json()
      
      if (accResponse.ok) {
        setAdAccounts(accData.data || [])
      }

      // Restore from localStorage
      const savedBM = localStorage.getItem('selectedBusinessManagerId')
      const savedAcc = localStorage.getItem('selectedAdAccountId')
      
      if (savedBM) setSelectedBusinessManagerId(savedBM)
      if (savedAcc) setSelectedAdAccountId(savedAcc)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    refreshData()
  }, [workspaceId])

  // Save selections to localStorage
  useEffect(() => {
    if (selectedBusinessManagerId) {
      localStorage.setItem('selectedBusinessManagerId', selectedBusinessManagerId)
    } else {
      localStorage.removeItem('selectedBusinessManagerId')
    }
  }, [selectedBusinessManagerId])

  useEffect(() => {
    if (selectedAdAccountId) {
      localStorage.setItem('selectedAdAccountId', selectedAdAccountId)
    } else {
      localStorage.removeItem('selectedAdAccountId')
    }
  }, [selectedAdAccountId])

  // When BM changes, reset ad account selection
  const setSelectedBusinessManager = (id: string | null) => {
    setSelectedBusinessManagerId(id)
    setSelectedAdAccountId(null) // Reset ad account when BM changes
  }

  const value: FilterContextType = {
    selectedBusinessManagerId,
    selectedAdAccountId,
    businessManagers,
    adAccounts,
    filteredAdAccounts,
    setSelectedBusinessManager,
    setSelectedAdAccount: setSelectedAdAccountId,
    refreshData,
    loading,
    error
  }

  return (
    <AdAccountFilterContext.Provider value={value}>
      {children}
    </AdAccountFilterContext.Provider>
  )
}

export function useAdAccountFilter() {
  const context = useContext(AdAccountFilterContext)
  
  // Return safe defaults if provider is not available
  if (context === undefined) {
    console.warn('useAdAccountFilter used outside of AdAccountFilterProvider - returning defaults')
    return {
      selectedBusinessManagerId: null,
      selectedAdAccountId: null,
      businessManagers: [],
      adAccounts: [],
      filteredAdAccounts: [],
      setSelectedBusinessManager: () => {},
      setSelectedAdAccount: () => {},
      refreshData: async () => {},
      loading: false,
      error: null
    }
  }
  
  return context
}
