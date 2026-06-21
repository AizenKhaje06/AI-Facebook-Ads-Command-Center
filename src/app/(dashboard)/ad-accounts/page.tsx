'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWorkspace } from '@/providers/WorkspaceProvider'
import { Building2, Plus, Link2, Unlink, RefreshCw, Check, TriangleAlert as AlertTriangle, Loader as Loader2, Users, Wallet, Shield, Megaphone, Layers, FileText, Calendar, Clock, Play, Pause, ChartBar as BarChart3 } from 'lucide-react'
import type { MetaConnection } from '@/lib/meta/types'

type SyncLog = {
  id: string
  meta_connection_id: string
  ad_account_id: string | null
  sync_type: 'full' | 'incremental' | 'manual' | 'scheduled'
  entity_type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial'
  total_records: number
  processed_records: number
  failed_records: number
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
  error_message: string | null
  rate_limit_remaining: number | null
  created_at: string
}

type SyncState = {
  entity_type: string
  last_sync_at: string | null
  last_successful_sync_at: string | null
  error_count: number
}

export default function AdAccountsPage() {
  const { currentWorkspace, membership } = useWorkspace()
  const [connections, setConnections] = useState<MetaConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [syncStates, setSyncStates] = useState<SyncState[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [showSyncDetails, setShowSyncDetails] = useState(false)

  const canManage = membership?.role === 'owner' || membership?.role === 'admin'

  const fetchConnections = useCallback(async () => {
    if (!currentWorkspace) return

    try {
      const response = await fetch(`/api/meta/status?workspace_id=${currentWorkspace.id}`)
      const data = await response.json()

      if (response.ok) {
        setConnections(data)
      } else {
        setError(data.error || 'Failed to fetch connections')
      }
    } catch (e) {
      setError('Failed to fetch connections')
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  const fetchSyncLogs = async (connectionId: string) => {
    setLoadingLogs(true)
    try {
      const response = await fetch(`/api/meta/sync/logs?connection_id=${connectionId}`)
      const data = await response.json()

      if (response.ok) {
        setSyncLogs(data.logs || [])
        setSyncStates(data.syncState || [])
      }
    } catch (e) {
      console.error('Failed to fetch sync logs:', e)
    } finally {
      setLoadingLogs(false)
    }
  }

  const handleSync = async (connectionId: string, entityType: 'all' | 'campaigns' | 'adsets' | 'ads' | 'insights' = 'all') => {
    if (!currentWorkspace) return

    setSyncing(connectionId)
    setError(null)

    try {
      // Set a timeout for the fetch request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

      const response = await fetch('/api/meta/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          entityType,
          syncType: 'manual',
          daysBack: 30
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed')
      }

      console.log('Sync completed:', data)

      // Show success message with details
      if (data.synced) {
        const total = data.synced.total || 0
        const duration = data.duration || 0
        const accountsProcessed = data.accountsProcessed || 0
        const totalAccounts = data.totalAccounts || 0
        
        setError(null)
        
        let message = `✅ Sync completed in ${duration}s!\n\n`
        message += `📊 Synced ${total} items:\n`
        message += `• ${data.synced.campaigns || 0} campaigns\n`
        message += `• ${data.synced.adsets || 0} ad sets\n`
        message += `• ${data.synced.ads || 0} ads\n`
        
        if (totalAccounts > accountsProcessed) {
          message += `\n⚠️ Note: Processed ${accountsProcessed} of ${totalAccounts} ad accounts to prevent timeout.\n`
          message += `Run sync again to process remaining accounts.`
        }
        
        alert(message)
      }

      // Refresh data
      await fetchConnections()
      if (selectedConnection === connectionId) {
        await fetchSyncLogs(connectionId)
      }
    } catch (e: any) {
      console.error('Sync error:', e)
      
      if (e.name === 'AbortError') {
        setError('Sync is taking longer than expected. It may still be running in the background. Please check back in a moment.')
      } else {
        setError(`Sync failed: ${e.message}`)
      }
    } finally {
      setSyncing(null)
    }
  }

  const handleDisconnect = async (connectionId: string, name: string) => {
    if (!confirm(`Disconnect "${name}"? This will remove all associated data.`)) return

    try {
      const response = await fetch(`/api/meta/connections/${connectionId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to disconnect')

      await fetchConnections()
      setSelectedConnection(null)
    } catch (e) {
      setError('Failed to disconnect account')
    }
  }

  const getConnectionStatus = (connection: MetaConnection) => {
    switch (connection.status) {
      case 'active':
        return { label: 'Active', color: 'text-green-400 bg-green-400/10' }
      case 'expired':
        return { label: 'Expired', color: 'text-yellow-400 bg-yellow-400/10' }
      case 'disconnected':
        return { label: 'Disconnected', color: 'text-slate-400 bg-slate-400/10' }
      case 'error':
        return { label: 'Error', color: 'text-red-400 bg-red-400/10' }
      default:
        return { label: 'Unknown', color: 'text-slate-400 bg-slate-400/10' }
    }
  }

  const getSyncLogStatus = (log: SyncLog) => {
    switch (log.status) {
      case 'completed':
        return { label: 'Completed', color: 'text-green-400', icon: Check }
      case 'running':
        return { label: 'Running', color: 'text-blue-400', icon: Loader2 }
      case 'failed':
        return { label: 'Failed', color: 'text-red-400', icon: AlertTriangle }
      case 'partial':
        return { label: 'Partial', color: 'text-yellow-400', icon: AlertTriangle }
      default:
        return { label: 'Pending', color: 'text-slate-400', icon: Clock }
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const getLastSyncFor = (entityType: string) => {
    const state = syncStates.find(s => s.entity_type === entityType)
    return state?.last_successful_sync_at
      ? new Date(state.last_successful_sync_at).toLocaleString()
      : 'Never'
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Meta Ad Accounts</h1>
          <p className="text-slate-400 mt-1">
            Connect and sync your Facebook ad accounts.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        </div>
      ) : connections.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Link2 className="w-10 h-10 text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Meta accounts connected</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Connect your Facebook Business Manager from the workspace settings to start syncing ad data.
          </p>
          {canManage && (
            <a
              href="/settings/workspace"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-lg transition-all"
            >
              <Shield className="w-5 h-5" />
              Go to Workspace Settings
            </a>
          )}
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Connections list */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-medium text-white">Connected Accounts</h2>
            {connections.map((connection: any) => {
              const status = getConnectionStatus(connection)
              const isSelected = selectedConnection === connection.id
              const stats = connection.stats || { campaigns: 0, adsets: 0, ads: 0 }

              return (
                <div
                  key={connection.id}
                  className={`bg-slate-800/50 border rounded-xl p-4 cursor-pointer transition-all ${
                    isSelected ? 'border-blue-500 bg-slate-800' : 'border-slate-700 hover:border-slate-600'
                  }`}
                  onClick={() => {
                    setSelectedConnection(connection.id)
                    fetchSyncLogs(connection.id)
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-full overflow-hidden">
                      {connection.facebook_user_picture_url ? (
                        <img
                          src={connection.facebook_user_picture_url}
                          alt={connection.facebook_user_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="w-5 h-5 text-slate-500 m-auto mt-2.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {connection.facebook_user_name}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-900/50 rounded p-2">
                      <Megaphone className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <p className="text-white font-medium">{stats.campaigns}</p>
                      <p className="text-slate-500">Campaigns</p>
                    </div>
                    <div className="bg-slate-900/50 rounded p-2">
                      <Layers className="w-4 h-4 text-green-400 mx-auto mb-1" />
                      <p className="text-white font-medium">{stats.adsets}</p>
                      <p className="text-slate-500">Ad Sets</p>
                    </div>
                    <div className="bg-slate-900/50 rounded p-2">
                      <FileText className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                      <p className="text-white font-medium">{stats.ads}</p>
                      <p className="text-slate-500">Ads</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Sync management */}
          <div className="lg:col-span-2">
            {selectedConnection ? (
              <div className="space-y-6">
                {/* Sync controls */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h2 className="text-lg font-medium text-white mb-4">Sync Data</h2>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <button
                      onClick={() => handleSync(selectedConnection, 'campaigns')}
                      disabled={syncing === selectedConnection}
                      className="flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-white px-4 py-3 rounded-lg transition-all disabled:opacity-50"
                    >
                      <Megaphone className="w-4 h-4" />
                      Campaigns
                    </button>
                    <button
                      onClick={() => handleSync(selectedConnection, 'adsets')}
                      disabled={syncing === selectedConnection}
                      className="flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-white px-4 py-3 rounded-lg transition-all disabled:opacity-50"
                    >
                      <Layers className="w-4 h-4" />
                      Ad Sets
                    </button>
                    <button
                      onClick={() => handleSync(selectedConnection, 'insights')}
                      disabled={syncing === selectedConnection}
                      className="flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-white px-4 py-3 rounded-lg transition-all disabled:opacity-50"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Insights
                    </button>
                    <button
                      onClick={() => handleSync(selectedConnection, 'all')}
                      disabled={syncing === selectedConnection}
                      className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-lg transition-all disabled:opacity-50"
                    >
                      {syncing === selectedConnection ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Sync All
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-sm text-slate-400">
                    Sync pulls the latest data from Meta. Last full sync: {getLastSyncFor('all')}
                  </p>
                </div>

                {/* Sync history */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h2 className="text-lg font-medium text-white mb-4">Sync History</h2>

                  {loadingLogs ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                    </div>
                  ) : syncLogs.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No sync history yet</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {syncLogs.map(log => {
                        const status = getSyncLogStatus(log)
                        const StatusIcon = status.icon
                        return (
                          <div key={log.id} className="bg-slate-900/50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <StatusIcon className={`w-4 h-4 ${status.color} ${log.status === 'running' ? 'animate-spin' : ''}`} />
                                <span className="text-white capitalize">{log.sync_type}</span>
                                <span className="text-slate-500">•</span>
                                <span className="text-slate-300">{log.entity_type}</span>
                              </div>
                              <span className="text-sm text-slate-400">
                                {log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-slate-400">
                              <span>{log.processed_records} records</span>
                              {!log.failed_records && log.failed_records > 0 && (
                                <span className="text-red-400">{log.failed_records} failed</span>
                              )}
                              {log.duration_seconds && (
                                <span>{formatDuration(log.duration_seconds)}</span>
                              )}
                            </div>

                            {log.error_message && (
                              <p className="text-sm text-red-400 mt-2">{log.error_message}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Ad Accounts */}
                {(() => {
                  const conn = connections.find((c: any) => c.id === selectedConnection) as any
                  return conn?.ad_accounts?.length > 0 && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                      <h2 className="text-lg font-medium text-white mb-4">Ad Accounts</h2>
                      <div className="grid md:grid-cols-2 gap-3">
                        {conn.ad_accounts.map((account: any) => (
                          <div key={account.id} className="bg-slate-900/50 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-2">
                              <Wallet className="w-5 h-5 text-slate-500" />
                              <div className="min-w-0 flex-1">
                                <p className="text-white truncate">{account.name}</p>
                                <p className="text-xs text-slate-500">{account.ad_account_id}</p>
                              </div>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-400">
                                Spent: {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: account.currency || 'USD'
                                }).format(account.amount_spent || 0)}
                              </span>
                              <span className={account.account_status === 1 ? 'text-green-400' : 'text-yellow-400'}>
                                {account.account_status === 1 ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Disconnect button */}
                {canManage && (
                  <button
                    onClick={() => {
                      const conn = connections.find((c: any) => c.id === selectedConnection) as any
                      if (conn) handleDisconnect(conn.id, conn.facebook_user_name)
                    }}
                    className="text-red-400 hover:text-red-300 text-sm flex items-center gap-2"
                  >
                    <Unlink className="w-4 h-4" />
                    Disconnect this account
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
                <p className="text-slate-400">Select a connection to manage sync settings</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
