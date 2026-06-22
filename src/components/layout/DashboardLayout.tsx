'use client'

import { useAuth } from '@/providers/AuthProvider'
import { useWorkspace } from '@/providers/WorkspaceProvider'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, Megaphone, ChartBar as BarChart3, Settings, User, LogOut, Menu, X, Building2, ChevronDown, Plus, Sparkles, Activity, TrendingUp, ChartLine as LineChart, Bell, MessageSquare, FileText, Search } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import AdAccountFilter from '@/components/filters/AdAccountFilter'
import { cn } from '@/lib/design-system'
import type { LucideIcon } from 'lucide-react'

type NavigationItem = {
  name: string
  href: string
  icon: LucideIcon
  description: string
}

const navigation: NavigationItem[] = [
  { 
    name: 'Overview', 
    href: '/dashboard', 
    icon: LayoutDashboard,
    description: 'View dashboard metrics' 
  },
  { 
    name: 'Ad Accounts', 
    href: '/ad-accounts', 
    icon: Building2,
    description: 'Manage connected accounts' 
  },
  { 
    name: 'Campaigns', 
    href: '/campaigns', 
    icon: Megaphone,
    description: 'View all campaigns' 
  },
  { 
    name: 'Analytics', 
    href: '/analytics', 
    icon: BarChart3,
    description: 'Deep performance insights' 
  },
  { 
    name: 'AI Insights', 
    href: '/insights', 
    icon: Sparkles,
    description: 'AI-powered recommendations' 
  },
  { 
    name: 'Health Score', 
    href: '/health', 
    icon: Activity,
    description: 'Campaign health monitoring' 
  },
  { 
    name: 'Recommendations', 
    href: '/recommendations', 
    icon: TrendingUp,
    description: 'Optimization suggestions' 
  },
  { 
    name: 'Forecasts', 
    href: '/forecasts', 
    icon: LineChart,
    description: 'Predictive analytics' 
  },
  { 
    name: 'Alerts', 
    href: '/alerts', 
    icon: Bell,
    description: 'Performance alerts' 
  },
  { 
    name: 'Reports', 
    href: '/reports', 
    icon: FileText,
    description: 'Custom reports' 
  },
  { 
    name: 'AI Assistant', 
    href: '/assistant', 
    icon: MessageSquare,
    description: 'Chat with AI' 
  },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth()
  const { workspaces, currentWorkspace, membership, switchWorkspace, loading } = useWorkspace()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const canManageWorkspace = membership?.role === 'owner' || membership?.role === 'admin'

  const filteredNavigation = searchQuery
    ? navigation.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : navigation

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 shadow-2xl transform transition-transform duration-300 lg:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <MobileSidebarContent
          navigation={filteredNavigation}
          pathname={pathname}
          onClose={() => setSidebarOpen(false)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-72 lg:flex lg:flex-col">
        <div className="flex-1 flex flex-col bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <Link href="/dashboard" className="text-xl font-bold text-gradient">
              AdPilot AI
            </Link>
          </div>

          {/* Workspace selector */}
          <div className="px-4 py-4 border-b border-slate-800">
            <div className="relative">
              <button
                onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 rounded-xl text-left hover:bg-slate-800 transition-all duration-200 group border border-slate-700/50 hover:border-slate-600"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {loading ? 'Loading...' : currentWorkspace?.name || 'No workspace'}
                    </p>
                    <p className="text-xs text-slate-400 capitalize truncate">
                      {membership?.role || 'member'}
                    </p>
                  </div>
                </div>
                <ChevronDown className={cn(
                  "w-4 h-4 text-slate-400 transition-transform flex-shrink-0",
                  workspaceDropdownOpen && "rotate-180"
                )} />
              </button>

              {workspaceDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-slideDown">
                  <div className="max-h-64 overflow-y-auto p-2">
                    {workspaces.map((workspace) => (
                      <button
                        key={workspace.id}
                        onClick={() => {
                          switchWorkspace(workspace.id)
                          setWorkspaceDropdownOpen(false)
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-700/50 transition-all text-left",
                          currentWorkspace?.id === workspace.id && "bg-blue-600/10 border border-blue-500/30"
                        )}
                      >
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-medium text-white truncate flex-1">
                          {workspace.name}
                        </span>
                      </button>
                    ))}
                  </div>
                  {canManageWorkspace && (
                    <div className="border-t border-slate-700 p-2">
                      <Link
                        href="/workspaces/new"
                        onClick={() => setWorkspaceDropdownOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 text-blue-400 hover:bg-slate-700/50 rounded-lg transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">Create workspace</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search navigation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30"
                      : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 animate-pulse" />
                  )}
                  <item.icon className="w-5 h-5 relative z-10" />
                  <span className="text-sm font-medium relative z-10">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Settings & Profile */}
          <div className="p-4 border-t border-slate-800 space-y-2">
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
                pathname.startsWith('/settings')
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30"
                  : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
              )}
            >
              <Settings className="w-5 h-5" />
              <span className="text-sm font-medium">Settings</span>
            </Link>

            <Link
              href="/profile"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/50 transition-all"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-700">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name || 'User'}
                    className="w-full h-full rounded-lg object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {user?.email}
                </p>
              </div>
            </Link>

            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Sign out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 px-4 lg:px-8 py-4 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            {/* Ad Account Filter - Desktop */}
            {currentWorkspace && (
              <div className="hidden lg:block flex-1">
                <AdAccountFilter />
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <NotificationBell />
            </div>
          </div>
          
          {/* Ad Account Filter - Mobile */}
          {currentWorkspace && (
            <div className="lg:hidden mt-4">
              <AdAccountFilter />
            </div>
          )}
        </div>

        <main className="p-4 lg:p-8 animate-fadeIn">{children}</main>
      </div>
    </div>
  )
}

function MobileSidebarContent({
  navigation,
  pathname,
  onClose,
  searchQuery,
  setSearchQuery,
}: {
  navigation: NavigationItem[]
  pathname: string
  onClose: () => void
  searchQuery: string
  setSearchQuery: (query: string) => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gradient">AdPilot AI</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search navigation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                  : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
