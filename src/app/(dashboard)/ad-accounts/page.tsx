'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWorkspace } from '@/providers/WorkspaceProvider'
import { useAuth } from '@/providers/AuthProvider'
import { Building2, Plus, Link2, Unlink, RefreshCw, Check, TriangleAlert as AlertTriangle, Loader as Loader2, ExternalLink, Users, Wallet, Shield, Crown } from 'lucide-react'
import type { MetaConnection, MetaBusinessManager, MetaAdAccount } from '@/lib/meta/types'
import { REQUIRED_SCOPES, SCOPE_DESCRIPTIONS } from '@/lib/meta/types'

export default function AdAccountsPage() {
  const { currentWorkspace, membership } = useWorkspace()
  const { user } = useAuth()
  const [connections, setConnections] = useState<MetaConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncingConnection, setSyncingConnection] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showOAuthPopup, setShowOAuthPopup] = useState(false)

  const canManage = membership?.role === 'owner' || membership?.role === 'admin'

  const fetchConnections = useCallback(async () => {
    if (!currentWorkspace) return

    try {
      const response = await fetch(`/api/meta/connections?workspace_id=${currentWorkspace.id}`)
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

  const handleConnectMeta = async () => {
    if (!currentWorkspace || !user) return

    setError(null)
    setConnecting(true)

    try {
      // Get OAuth URL
      const response = await fetch('/api/meta/connect')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get OAuth URL')
      }

      // Open OAuth popup
      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      const popup = window.open(
        data.authUrl,
        'MetaOAuth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      )

      // Listen for OAuth callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return

        if (event.data.type === 'META_OAUTH_SUCCESS') {
          popup?.close()
          window.removeEventListener('message', handleMessage)

          // Exchange code for tokens
          const callbackResponse = await fetch('/api/meta/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: event.data.code,
              state: event.data.state,
              workspace_id: currentWorkspace.id
            })
          })

          const callbackData = await callbackResponse.json()

          if (!callbackResponse.ok) {
            throw new Error(callbackData.error || 'Failed to connect account')
          }

          await fetchConnections()
          setConnecting(false)
        }

        if (event.data.type === 'META_OAUTH_ERROR') {
          popup?.close()
          window.removeEventListener('message', handleMessage)
          setError(event.data.error || 'Authentication failed')
          setConnecting(false)
        }
      }

      window.addEventListener('message', handleMessage)

      // Check if popup was closed without completing
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleMessage)
          setConnecting(false)
        }
      }, 1000)

    } catch (e: any) {
      setError(e.message || 'Failed to connect Meta account')
      setConnecting(false)
    }
  }

  const handleDisconnect = async (connectionId: string, name: string) => {
    if (!confirm(`Disconnect "${name}"? This will remove all associated data.`)) return

    try {
      const response = await fetch(`/api/meta/connections/${connectionId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect')
      }

      await fetchConnections()
    } catch (e) {
      setError('Failed to disconnect account')
    }
  }

  const handleReconnect = async (connectionId: string) => {
    // Reconnect is essentially the same as connecting
    await handleConnectMeta()
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

  const hasRequiredScopes = (connection: MetaConnection) => {
    if (!connection.granted_scopes) return false
    return REQUIRED_SCOPES.every(scope => connection.granted_scopes!.includes(scope))
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Meta Ad Accounts</h1>
          <p className="text-slate-400 mt-1">
            Connect and manage your Facebook ad accounts.
          </p>
        </div>
        {canManage && connections.length > 0 && (
          <button
            onClick={handleConnectMeta}
            disabled={connecting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium px-4 py-2.5 rounded-lg transition-all"
          >
            {connecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Add Account
              </>
            )}
          </button>
        )}
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
            Connect your Facebook Business Manager to start syncing your ad accounts and campaigns.
          </p>

          <div className="bg-slate-900/50 rounded-lg p-4 mb-6 max-w-md mx-auto">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2 justify-center">
              <Shield className="w-4 h-4" />
              Required Permissions
            </h3>
            <div className="space-y-2 text-left">
              {REQUIRED_SCOPES.map(scope => (
                <div key={scope} className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-400" />
                  {SCOPE_DESCRIPTIONS[scope] || scope}
                </div>
              ))}
            </div>
          </div>

          {canManage ? (
            <button
              onClick={handleConnectMeta}
              disabled={connecting}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium px-6 py-3 rounded-lg transition-all"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="w-5 h-5" />
                  Connect Meta Account
                </>
              )}
            </button>
          ) : (
            <p className="text-slate-500 text-sm">
              Only workspace admins can connect Meta accounts.
            </p>
          )}

          <p className="text-xs text-slate-500 mt-4">
            You&apos;ll be redirected to Facebook to authorize access.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {connections.map(connection => {
            const status = getConnectionStatus(connection)
            const hasAllScopes = hasRequiredScopes(connection)

            return (
              <div
                key={connection.id}
                className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden"
              >
                {/* Connection Header */}
                <div className="p-5 flex items-center justify-between border-b border-slate-700">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center overflow-hidden">
                      {connection.facebook_user_picture_url ? (
                        <img
                          src={connection.facebook_user_picture_url}
                          alt={connection.facebook_user_name || 'User'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="w-6 h-6 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-white">
                          {connection.facebook_user_name || 'Facebook User'}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">
                        {connection.facebook_user_email || connection.facebook_user_id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!hasAllScopes && (
                      <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">
                        <AlertTriangle className="w-3 h-3" />
                        Missing permissions
                      </span>
                    )}
                    {canManage && (
                      <>
                        <button
                          onClick={() => handleReconnect(connection.id)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          title="Reconnect"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDisconnect(connection.id, connection.facebook_user_name || 'account')}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Disconnect"
                        >
                          <Unlink className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Business Managers & Ad Accounts */}
                {(connection as any).business_managers?.length > 0 && (
                  <div className="p-5">
                    <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Business Managers & Ad Accounts
                    </h4>
                    <div className="space-y-3">
                      {(connection as any).business_managers.map((bm: MetaBusinessManager & { ad_accounts: MetaAdAccount[] }) => (
                        <div key={bm.id} className="bg-slate-900/50 rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-3">
                            {bm.profile_picture_url ? (
                              <img
                                src={bm.profile_picture_url}
                                alt={bm.name}
                                className="w-8 h-8 rounded"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-slate-500" />
                              </div>
                            )}
                            <span className="font-medium text-white">{bm.name}</span>
                            <span className="text-xs text-slate-500">ID: {bm.business_manager_id}</span>
                          </div>

                          {bm.ad_accounts?.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {bm.ad_accounts.map((account) => (
                                <div
                                  key={account.id}
                                  className="flex items-center justify-between bg-slate-800 rounded-lg p-3"
                                >
                                  <div className="flex items-center gap-3">
                                    <Wallet className="w-4 h-4 text-slate-500" />
                                    <div>
                                      <p className="text-sm text-white">{account.name}</p>
                                      <p className="text-xs text-slate-500">
                                        {account.ad_account_id} • {account.currency}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm text-white">
                                      {new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: account.currency
                                      }).format(account.amount_spent)}
                                    </p>
                                    <p className="text-xs text-slate-500">Spent</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {(!bm.ad_accounts || bm.ad_accounts.length === 0) && (
                            <p className="text-sm text-slate-500">No ad accounts found</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {connection.last_error_message && (
                  <div className="px-5 py-3 bg-red-500/10 border-t border-red-500/20">
                    <p className="text-sm text-red-400">
                      <strong>Error:</strong> {connection.last_error_message}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Info panel */}
      {connections.length > 0 && (
        <div className="mt-8 bg-slate-800/30 border border-slate-700 rounded-xl p-5">
          <h3 className="text-sm font-medium text-white mb-3">About Meta Connections</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-slate-500 mt-0.5" />
              <span>Access tokens are encrypted and stored securely</span>
            </li>
            <li className="flex items-start gap-2">
              <RefreshCw className="w-4 h-4 text-slate-500 mt-0.5" />
              <span>Tokens are automatically refreshed before expiration</span>
            </li>
            <li className="flex items-start gap-2">
              <Unlink className="w-4 h-4 text-slate-500 mt-0.5" />
              <span>You can disconnect accounts anytime from this page</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
