'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWorkspace } from '@/providers/WorkspaceProvider'
import { Building2, Users, Loader as Loader2, Plus, Trash2, User, Crown, Link2, RefreshCw, Check, TriangleAlert as AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import type { MetaConnection } from '@/lib/meta/types'

type MemberWithProfile = {
  id: string
  user_id: string
  workspace_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joined_at: string
  users: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }
}

export default function WorkspaceSettingsPage() {
  const { currentWorkspace, membership } = useWorkspace()
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [connections, setConnections] = useState<MetaConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('viewer')
  const [inviting, setInviting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const canManageMembers = membership?.role === 'owner' || membership?.role === 'admin'

  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace) return

    try {
      const response = await fetch(`/api/workspaces/${currentWorkspace.id}/members`)
      const data = await response.json()

      if (response.ok) {
        setMembers(data)
      }
    } catch (e) {
      console.error('Failed to fetch members:', e)
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace])

  const fetchConnections = useCallback(async () => {
    if (!currentWorkspace) return

    try {
      const response = await fetch(`/api/meta/status?workspace_id=${currentWorkspace.id}`)
      const data = await response.json()

      if (response.ok) {
        setConnections(data)
      }
    } catch (e) {
      console.error('Failed to fetch connections:', e)
    } finally {
      setLoadingConnections(false)
    }
  }, [currentWorkspace])

  useEffect(() => {
    if (currentWorkspace) {
      fetchMembers()
      fetchConnections()
    }
  }, [currentWorkspace, fetchMembers, fetchConnections])

  // Handle OAuth callback from popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return

      if (event.data?.type === 'META_OAUTH_SUCCESS') {
        setConnecting(false)
        setSuccess('Meta account connected successfully!')
        await fetchConnections()
      }

      if (event.data?.type === 'META_OAUTH_ERROR') {
        setConnecting(false)
        setError(event.data.error || 'Failed to connect Meta account')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [fetchConnections])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setInviting(true)

    try {
      const response = await fetch(`/api/workspaces/${currentWorkspace?.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite member')
      }

      await fetchMembers()
      setInviteEmail('')
      setSuccess(`Invited ${inviteEmail} as ${inviteRole}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to invite member'
      setError(message)
    } finally {
      setInviting(false)
    }
  }

  const handleConnectMeta = async () => {
    setError(null)
    setConnecting(true)

    if (!currentWorkspace) {
      setError('No workspace selected')
      setConnecting(false)
      return
    }

    try {
      // Store workspace ID for callback
      localStorage.setItem('meta_oauth_workspace_id', currentWorkspace.id)

      // Get OAuth URL from our API
      const response = await fetch('/api/meta/connect')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get OAuth URL')
      }

      // Open popup for OAuth
      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      const popup = window.open(
        data.authUrl,
        'MetaOAuth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      )

      // If popup was blocked
      if (!popup) {
        setConnecting(false)
        localStorage.removeItem('meta_oauth_workspace_id')
        setError('Popup was blocked. Please allow popups for this site.')
      }
      // The popup will send a message when done
    } catch (e: unknown) {
      setConnecting(false)
      localStorage.removeItem('meta_oauth_workspace_id')
      const message = e instanceof Error ? e.message : 'Failed to connect'
      setError(message)
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
      setSuccess(`Disconnected ${name}`)
    } catch (e) {
      setError('Failed to disconnect account')
    }
  }

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Remove ${memberEmail} from this workspace?`)) return

    try {
      const response = await fetch(`/api/workspaces/${currentWorkspace?.id}/members/${memberId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to remove member')

      await fetchMembers()
    } catch (e) {
      setError('Failed to remove member')
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/workspaces/${currentWorkspace?.id}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (!response.ok) throw new Error('Failed to update role')

      await fetchMembers()
    } catch (e) {
      setError('Failed to update role')
    }
  }

  const getConnectionStatus = (connection: MetaConnection) => {
    switch (connection.status) {
      case 'active':
        return { label: 'Active', color: 'text-green-400 bg-green-400/10' }
      case 'expired':
        return { label: 'Expired', color: 'text-yellow-400 bg-yellow-400/10' }
      case 'error':
        return { label: 'Error', color: 'text-red-400 bg-red-400/10' }
      default:
        return { label: 'Unknown', color: 'text-slate-400 bg-slate-400/10' }
    }
  }

  if (!canManageMembers) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
          You don&apos;t have permission to manage workspace settings.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <Link
          href="/settings"
          className="text-sm text-slate-400 hover:text-white mb-2 inline-block"
        >
          ← Back to settings
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Building2 className="w-6 h-6" />
          {currentWorkspace?.name}
        </h1>
        <p className="text-slate-400 mt-1">
          Manage workspace settings, team members, and Meta connections.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Meta Integration Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Meta Integration
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Connect your Facebook Business Manager to sync ad data
            </p>
          </div>
          <button
            onClick={handleConnectMeta}
            disabled={connecting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-medium px-4 py-2.5 rounded-lg transition-all"
          >
            {connecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Connect Meta Account
              </>
            )}
          </button>
        </div>

        {loadingConnections ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        ) : connections.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-600 rounded-lg">
            <Link2 className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400 mb-2">No Meta accounts connected</p>
            <p className="text-xs text-slate-500">
              Click &quot;Connect Meta Account&quot; to link your Facebook Business Manager
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((connection) => {
              const status = getConnectionStatus(connection)
              const stats = (connection as MetaConnection & { stats?: { campaigns: number; adsets: number; ads: number } }).stats || { campaigns: 0, adsets: 0, ads: 0 }

              return (
                <div
                  key={connection.id}
                  className="flex items-center justify-between bg-slate-900/50 rounded-lg p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-700 rounded-full overflow-hidden">
                      {connection.facebook_user_picture_url ? (
                        <img
                          src={connection.facebook_user_picture_url}
                          alt={connection.facebook_user_name || 'User'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6 text-slate-500 m-auto mt-3" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {connection.facebook_user_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="text-xs text-slate-500">
                          {stats.campaigns} campaigns, {stats.adsets} ad sets, {stats.ads} ads
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/ad-accounts"
                      className="flex items-center gap-1 text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded hover:bg-slate-700 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Manage
                    </Link>
                    <button
                      onClick={() => handleDisconnect(connection.id, connection.facebook_user_name || 'Unknown')}
                      className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4 p-4 bg-slate-900/50 rounded-lg">
          <h3 className="text-sm font-medium text-white mb-2">How to Connect</h3>
          <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
            <li>Click &quot;Connect Meta Account&quot; button above</li>
            <li>Log in to your Facebook account in the popup</li>
            <li>Select your Business Manager and Ad Accounts</li>
            <li>Grant permissions to access your ad data</li>
            <li>Sync your data from the Ad Accounts page</li>
          </ol>
        </div>
      </div>

      {/* Members section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5" />
              Members
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Team members with access to this workspace
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between bg-slate-900/50 rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                    {member.users.avatar_url ? (
                      <img
                        src={member.users.avatar_url}
                        alt={member.users.full_name || 'User'}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {member.users.full_name || 'User'}
                    </p>
                    <p className="text-sm text-slate-400">{member.users.email}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {member.role === 'owner' && (
                      <Crown className="w-4 h-4 text-yellow-500" />
                    )}
                    {member.role !== 'owner' && canManageMembers && member.user_id !== membership?.user_id ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded capitalize">
                        {member.role}
                      </span>
                    )}
                  </div>
                </div>

                {canManageMembers && member.role !== 'owner' && member.user_id !== membership?.user_id && (
                  <button
                    onClick={() => handleRemoveMember(member.id, member.users.email)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Invite Member</h2>
        <form onSubmit={handleInvite} className="flex gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
            className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter email address"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
            className="bg-slate-700 border border-slate-600 rounded-lg px-4 text-white"
          >
            <option value="viewer">Viewer</option>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={inviting || !inviteEmail}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-medium px-4 py-2.5 rounded-lg transition-all"
          >
            {inviting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
            Invite
          </button>
        </form>
      </div>
    </div>
  )
}
