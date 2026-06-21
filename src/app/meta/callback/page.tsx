'use client'

import { useEffect, useState } from 'react'
import { Loader as Loader2, Check, TriangleAlert as AlertTriangle } from 'lucide-react'

export default function MetaCallbackPage() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const errorParam = url.searchParams.get('error')
      const errorDescription = url.searchParams.get('error_description')

      // Handle OAuth error from Meta
      if (errorParam) {
        setStatus('error')
        setError(errorDescription || errorParam)
        if (window.opener) {
          window.opener.postMessage(
            { type: 'META_OAUTH_ERROR', error: errorDescription || errorParam },
            window.location.origin
          )
          setTimeout(() => window.close(), 2000)
        }
        return
      }

      if (!code) {
        setStatus('error')
        setError('No authorization code received')
        if (window.opener) {
          window.opener.postMessage(
            { type: 'META_OAUTH_ERROR', error: 'No authorization code received' },
            window.location.origin
          )
          setTimeout(() => window.close(), 2000)
        }
        return
      }

      // Get workspace_id from localStorage (set before opening popup)
      const workspaceId = localStorage.getItem('meta_oauth_workspace_id')

      if (!workspaceId) {
        setStatus('error')
        setError('Workspace ID not found. Please try connecting again from workspace settings.')
        if (window.opener) {
          window.opener.postMessage(
            { type: 'META_OAUTH_ERROR', error: 'Workspace ID not found' },
            window.location.origin
          )
          setTimeout(() => window.close(), 2000)
        }
        return
      }

      try {
        // Exchange code for tokens via our API
        const response = await fetch('/api/meta/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state, workspace_id: workspaceId })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to complete connection')
        }

        setStatus('success')
        localStorage.removeItem('meta_oauth_workspace_id')

        // Notify parent window of success
        if (window.opener) {
          window.opener.postMessage(
            { type: 'META_OAUTH_SUCCESS', connection: data.connection },
            window.location.origin
          )
          setTimeout(() => window.close(), 1500)
        } else {
          // Redirect if not in popup
          setTimeout(() => {
            window.location.href = '/ad-accounts'
          }, 1500)
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Connection failed'
        setStatus('error')
        setError(message)
        if (window.opener) {
          window.opener.postMessage(
            { type: 'META_OAUTH_ERROR', error: message },
            window.location.origin
          )
          setTimeout(() => window.close(), 3000)
        }
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center max-w-md px-4">
        {status === 'processing' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Connecting your Meta account...</h1>
            <p className="text-slate-400">Please wait while we complete the connection.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-500/10 border border-green-500/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Connected Successfully!</h1>
            <p className="text-slate-400">You can close this window and sync your data.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Connection Failed</h1>
            <p className="text-slate-400 mb-4">{error}</p>
            <button
              onClick={() => window.close()}
              className="text-blue-400 hover:text-blue-300"
            >
              Close this window
            </button>
          </>
        )}
      </div>
    </div>
  )
}
