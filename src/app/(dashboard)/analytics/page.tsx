'use client'

import { useState, useEffect, useMemo } from 'react'
import { useWorkspace } from '@/providers/WorkspaceProvider'
import {
  ChevronRight, ChevronDown, Search, Columns3, Save, Loader as Loader2,
  RefreshCw, Megaphone, Layers, FileText, DollarSign, Eye, MousePointerClick,
  Target, TrendingUp, Calendar, ShoppingCart, CreditCard, Play, Clock, Users, X
} from 'lucide-react'
import {
  SpendChart, RevenueChart, ROASChart, CPAChart, CTRChart,
  PerformanceChart, FunnelChart, ClicksImpressionsChart
} from '@/components/analytics/Charts'
import { aggregateByPeriod, TimeAggregation } from '@/lib/timeAggregation'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/formatters'

type Insight = any
type SavedView = {
  id: string
  name: string
  view_type: string
  columns: string[]
  filters: Record<string, any>
  sort_by: string
  sort_order: string
  is_default: boolean
}

const AVAILABLE_COLUMNS = [
  { id: 'name', label: 'Name', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'budget', label: 'Budget', default: true },
  { id: 'spend', label: 'Spend', default: true },
  { id: 'impressions', label: 'Impressions', default: true },
  { id: 'clicks', label: 'Clicks', default: true },
  { id: 'ctr', label: 'CTR', default: true },
  { id: 'cpc', label: 'CPC', default: true },
  { id: 'cpm', label: 'CPM', default: false },
  { id: 'conversions', label: 'Conv.', default: true },
  { id: 'cpa', label: 'CPA', default: false },
  { id: 'roas', label: 'ROAS', default: false },
  { id: 'purchase_value', label: 'Revenue', default: false },
  { id: 'add_to_cart', label: 'Add to Cart', default: false },
  { id: 'checkout', label: 'Checkout', default: false },
  { id: 'leads', label: 'Leads', default: false },
  { id: 'video_p100', label: 'Video 100%', default: false },
  { id: 'reach', label: 'Reach', default: false },
  { id: 'frequency', label: 'Freq.', default: false },
]

const DATE_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Custom', days: null },
]

const AGGREGATION_OPTIONS: { value: TimeAggregation; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

export default function AnalyticsPage() {
  const { currentWorkspace } = useWorkspace()

  // Metrics data
  const [metrics, setMetrics] = useState<any>(null)
  const [timeSeries, setTimeSeries] = useState<any[]>([])
  const [insights, setInsights] = useState<Record<string, Insight>>({})
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [adsets, setAdsets] = useState<Record<string, any[]>>({})
  const [ads, setAds] = useState<Record<string, any[]>>({})

  // UI state
  const [activeChart, setActiveChart] = useState<'performance' | 'funnel' | 'clicks'>('performance')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set())

  // Date range
  const [datePreset, setDatePreset] = useState(30)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showDateCustom, setShowDateCustom] = useState(false)

  // Time aggregation
  const [timeAggregation, setTimeAggregation] = useState<TimeAggregation>('daily')

  // Filter/sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('spend')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Column customization
  const [columns, setColumns] = useState<string[]>(() =>
    AVAILABLE_COLUMNS.filter(c => c.default).map(c => c.id)
  )
  const [showColumnPicker, setShowColumnPicker] = useState(false)

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [activeView, setActiveView] = useState<SavedView | null>(null)
  const [showSaveViewModal, setShowSaveViewModal] = useState(false)
  const [newViewName, setNewViewName] = useState('')

  // Initialize dates
  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    setEndDate(end.toISOString().split('T')[0])
    setStartDate(start.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (currentWorkspace && startDate && endDate) {
      loadSavedViews()
      loadMetrics()
      loadData()
    }
  }, [currentWorkspace, startDate, endDate])

  const loadSavedViews = async () => {
    if (!currentWorkspace) return
    try {
      const response = await fetch(`/api/views?workspace_id=${currentWorkspace.id}&view_type=campaigns`)
      const views = await response.json()
      setSavedViews(views || [])
      const defaultView = views?.find((v: SavedView) => v.is_default)
      if (defaultView) applyView(defaultView)
    } catch (e) {
      console.error('Failed to load saved views:', e)
    }
  }

  const loadMetrics = async () => {
    if (!currentWorkspace) return
    try {
      const params = new URLSearchParams({
        workspace_id: currentWorkspace.id,
        start_date: startDate,
        end_date: endDate,
        entity_type: 'campaign'
      })
      const response = await fetch(`/api/metrics?${params}`)
      const data = await response.json()
      if (response.ok) {
        setMetrics(data.totals)
        setTimeSeries(data.timeSeries || [])
      }
    } catch (e) {
      console.error('Failed to load metrics:', e)
    }
  }

  const loadData = async () => {
    if (!currentWorkspace) return
    setLoading(true)
    setError(null)

    try {
      const connResponse = await fetch(`/api/meta/status?workspace_id=${currentWorkspace.id}`)
      const connections = await connResponse.json()

      if (!connResponse.ok) {
        throw new Error(connections.error || 'Failed to fetch connections')
      }

      const allCampaigns: any[] = []
      const insightMap: Record<string, Insight> = {}

      for (const conn of connections || []) {
        const { data: campaignList } = await fetch(`/api/meta/campaigns?connection_id=${conn.id}`).then(r => r.json())
        if (campaignList) allCampaigns.push(...campaignList)

        const insightParams = new URLSearchParams({
          connection_id: conn.id,
          entity_type: 'campaign',
          start_date: startDate,
          end_date: endDate
        })

        const { insights: campaignInsights } = await fetch(`/api/meta/insights?${insightParams}`).then(r => r.json())
        campaignInsights?.forEach((i: Insight) => {
          insightMap[i.entity_id_meta] = i
        })
      }

      setCampaigns(allCampaigns)
      setInsights(insightMap)
    } catch (e: any) {
      setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadAdsetsForCampaign = async (campaignId: string, campaignMetaId: string) => {
    try {
      const { data } = await fetch(`/api/meta/adsets?campaign_id=${campaignId}`).then(r => r.json())
      setAdsets(prev => ({ ...prev, [campaignMetaId]: data || [] }))

      const campaign = campaigns.find(c => c.campaign_id === campaignMetaId)
      if (campaign) {
        const params = new URLSearchParams({
          connection_id: campaign.meta_connection_id,
          entity_type: 'adset',
          start_date: startDate,
          end_date: endDate
        })
        const { insights: adsetInsights } = await fetch(`/api/meta/insights?${params}`).then(r => r.json())
        adsetInsights?.forEach((i: Insight) => {
          setInsights(prev => ({ ...prev, [i.entity_id_meta]: i }))
        })
      }
    } catch (e) {
      console.error('Failed to load adsets:', e)
    }
  }

  const loadAdsForAdset = async (adsetId: string, adsetMetaId: string, connectionId: string) => {
    try {
      const { data } = await fetch(`/api/meta/ads?adset_id=${adsetId}`).then(r => r.json())
      setAds(prev => ({ ...prev, [adsetMetaId]: data || [] }))

      const params = new URLSearchParams({
        connection_id: connectionId,
        entity_type: 'ad',
        start_date: startDate,
        end_date: endDate
      })
      const { insights: adInsights } = await fetch(`/api/meta/insights?${params}`).then(r => r.json())
      adInsights?.forEach((i: Insight) => {
        setInsights(prev => ({ ...prev, [i.entity_id_meta]: i }))
      })
    } catch (e) {
      console.error('Failed to load ads:', e)
    }
  }

  const handleDatePresetChange = (days: number | null) => {
    if (days === null) {
      setShowDateCustom(true)
      setDatePreset(0)
    } else {
      setShowDateCustom(false)
      setDatePreset(days)
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - days)
      setEndDate(end.toISOString().split('T')[0])
      setStartDate(start.toISOString().split('T')[0])
    }
  }

  const toggleCampaign = async (campaign: any) => {
    const campaignId = campaign.campaign_id
    const newExpanded = new Set(expandedCampaigns)
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId)
    } else {
      newExpanded.add(campaignId)
      if (!adsets[campaignId]) {
        await loadAdsetsForCampaign(campaign.id, campaignId)
      }
    }
    setExpandedCampaigns(newExpanded)
  }

  const toggleAdset = async (adset: any, connectionId: string) => {
    const adsetId = adset.adset_id
    const newExpanded = new Set(expandedAdsets)
    if (newExpanded.has(adsetId)) {
      newExpanded.delete(adsetId)
    } else {
      newExpanded.add(adsetId)
      if (!ads[adsetId]) {
        await loadAdsForAdset(adset.id, adsetId, connectionId)
      }
    }
    setExpandedAdsets(newExpanded)
  }

  const applyView = (view: SavedView) => {
    setColumns(view.columns.filter(c => AVAILABLE_COLUMNS.some(ac => ac.id === c)))
    setSortBy(view.sort_by)
    setSortOrder(view.sort_order as 'asc' | 'desc')
    setSearchQuery(view.filters?.search || '')
    setStatusFilter(view.filters?.status || 'all')
    setActiveView(view)
  }

  const saveCurrentView = async () => {
    if (!currentWorkspace || !newViewName.trim()) return

    try {
      const response = await fetch('/api/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: currentWorkspace.id,
          name: newViewName,
          view_type: 'campaigns',
          columns,
          filters: { search: searchQuery, status: statusFilter },
          sort_by: sortBy,
          sort_order: sortOrder
        })
      })

      const view = await response.json()
      setSavedViews(prev => [...prev, view])
      setActiveView(view)
      setShowSaveViewModal(false)
      setNewViewName('')
    } catch (e) {
      console.error('Failed to save view:', e)
    }
  }

  // Aggregated chart data
  const chartData = useMemo(() => {
    return aggregateByPeriod(timeSeries, timeAggregation)
  }, [timeSeries, timeAggregation])

  // Filter and sort campaigns
  const processedCampaigns = campaigns
    .filter(c => {
      if (statusFilter !== 'all') {
        const effective = c.effective_status || c.status
        if (effective?.toUpperCase() !== statusFilter.toUpperCase()) return false
      }
      if (searchQuery) {
        return c.name.toLowerCase().includes(searchQuery.toLowerCase())
      }
      return true
    })
    .sort((a, b) => {
      const aVal = sortBy === 'name' ? a.name : insights[a.campaign_id]?.[sortBy] || 0
      const bVal = sortBy === 'name' ? b.name : insights[b.campaign_id]?.[sortBy] || 0
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      }
      return aVal < bVal ? 1 : -1
    })

  const paginatedCampaigns = processedCampaigns.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const totalPages = Math.ceil(processedCampaigns.length / pageSize)

  const getStatusColor = (status: string | null) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'text-green-400 bg-green-400/10'
      case 'PAUSED': return 'text-yellow-400 bg-yellow-400/10'
      case 'COMPLETED': return 'text-blue-400 bg-blue-400/10'
      default: return 'text-slate-400 bg-slate-400/10'
    }
  }

  const toggleColumn = (colId: string) => {
    setColumns(prev =>
      prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]
    )
  }

  const renderCellValue = (item: any, ins: Insight | undefined, colId: string) => {
    const currency = item.ad_account?.currency || 'USD'

    switch (colId) {
      case 'name': return item.name
      case 'status': return (
        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(item.effective_status || item.status)}`}>
          {item.effective_status || item.status || 'Unknown'}
        </span>
      )
      case 'budget': return formatCurrency((item.daily_budget || item.lifetime_budget || 0) / 100, currency)
      case 'spend': return formatCurrency(ins?.spend || 0, currency)
      case 'impressions': return formatNumber(ins?.impressions || 0)
      case 'clicks': return formatNumber(ins?.clicks || 0)
      case 'ctr': return formatPercent(ins?.ctr || 0)
      case 'cpc': return formatCurrency(ins?.cpc || 0, currency)
      case 'cpm': return formatCurrency(ins?.cpm || 0, currency)
      case 'conversions': return formatNumber(ins?.conversions || 0)
      case 'cpa': return formatCurrency(ins?.cpa || 0, currency)
      case 'roas': return (ins?.roas || 0).toFixed(2)
      case 'purchase_value': return formatCurrency(ins?.purchase_value || 0, currency)
      case 'add_to_cart': return formatNumber(ins?.add_to_cart || 0)
      case 'checkout': return formatNumber(ins?.checkout || 0)
      case 'leads': return formatNumber(ins?.leads || 0)
      case 'video_p100': return formatNumber(ins?.video_p100_watched || 0)
      case 'reach': return formatNumber(ins?.reach || 0)
      case 'frequency': return (ins?.frequency || 0).toFixed(2)
      default: return '-'
    }
  }

  return (
    <div className="max-w-full mx-auto px-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaign Analytics</h1>
          <p className="text-slate-400 mt-1">
            {processedCampaigns.length} campaigns • {formatCurrency(metrics?.spend || 0)} total spend
          </p>
        </div>
        <button
          onClick={() => { loadMetrics(); loadData() }}
          disabled={loading}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Date Range & Aggregation */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Date Range:</span>
            </div>
            <div className="flex items-center gap-2">
              {DATE_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => handleDatePresetChange(preset.days)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    (preset.days === null && showDateCustom) || preset.days === datePreset
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">View:</span>
            </div>
            <div className="flex items-center gap-2">
              {AGGREGATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTimeAggregation(opt.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    timeAggregation === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {showDateCustom && (
            <div className="flex items-center gap-2 ml-4">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
              />
              <button
                onClick={() => setShowDateCustom(false)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <MetricCard title="Spend" value={formatCurrency(metrics.spend)} icon={DollarSign} color="blue" />
          <MetricCard title="Revenue" value={formatCurrency(metrics.purchase_value)} icon={TrendingUp} color="green" />
          <MetricCard title="ROAS" value={metrics.roas?.toFixed(2) || '0.00'} icon={Target} color="purple" />
          <MetricCard title="CPA" value={formatCurrency(metrics.cpa)} icon={CreditCard} color="yellow" />
          <MetricCard title="CPM" value={formatCurrency(metrics.cpm)} icon={Eye} color="slate" />
          <MetricCard title="CPC" value={formatCurrency(metrics.cpc)} icon={MousePointerClick} color="cyan" />
          <MetricCard title="CTR" value={formatPercent(metrics.ctr)} icon={TrendingUp} color="pink" />
          <MetricCard title="Impressions" value={formatNumber(metrics.impressions)} icon={Eye} color="slate" />
          <MetricCard title="Clicks" value={formatNumber(metrics.clicks)} icon={MousePointerClick} color="blue" />
          <MetricCard title="Conversions" value={formatNumber(metrics.conversions)} icon={TrendingUp} color="green" />
          <MetricCard title="Add to Cart" value={formatNumber(metrics.add_to_cart)} icon={ShoppingCart} color="orange" />
          <MetricCard title="Checkout" value={formatNumber(metrics.checkout)} icon={CreditCard} color="emerald" />
        </div>
      )}

      {/* Charts Section */}
      {timeSeries.length > 0 && (
        <div className="mb-6">
          {/* Chart Tabs */}
          <div className="flex items-center gap-2 mb-4">
            {[
              { key: 'performance', label: 'Spend & Revenue' },
              { key: 'funnel', label: 'Funnel Metrics' },
              { key: 'clicks', label: 'Clicks & Impressions' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveChart(tab.key as any)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  activeChart === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Charts Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {activeChart === 'performance' && (
              <>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-4">Spend Over Time</h3>
                  <SpendChart data={chartData} height={250} />
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-4">Revenue Over Time</h3>
                  <RevenueChart data={chartData} height={250} />
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-4">ROAS Trend</h3>
                  <ROASChart data={chartData} height={250} />
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-4">Performance Overview</h3>
                  <PerformanceChart data={chartData} height={250} />
                </div>
              </>
            )}

            {activeChart === 'funnel' && (
              <>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 lg:col-span-2">
                  <h3 className="text-sm font-medium text-slate-400 mb-4">Conversion Funnel</h3>
                  <FunnelChart data={chartData} height={250} />
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-4">CPA Trend</h3>
                  <CPAChart data={chartData} height={250} />
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-4">Conversions Over Time</h3>
                  <PerformanceChart data={chartData} height={250} />
                </div>
              </>
            )}

            {activeChart === 'clicks' && (
              <>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 lg:col-span-2">
                  <h3 className="text-sm font-medium text-slate-400 mb-4">Clicks & Impressions</h3>
                  <ClicksImpressionsChart data={chartData} height={250} />
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-4">CTR Trend</h3>
                  <CTRChart data={chartData} height={250} />
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-4">Spend vs Revenue</h3>
                  <PerformanceChart data={chartData} height={250} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white"
          >
            <option value="all">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [by, order] = e.target.value.split(':')
              setSortBy(by)
              setSortOrder(order as 'asc' | 'desc')
            }}
            className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white"
          >
            <option value="spend:desc">Spend (High to Low)</option>
            <option value="spend:asc">Spend (Low to High)</option>
            <option value="roas:desc">ROAS (High to Low)</option>
            <option value="clicks:desc">Clicks (High to Low)</option>
            <option value="impressions:desc">Impressions (High to Low)</option>
            <option value="name:asc">Name A-Z</option>
          </select>

          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="flex items-center gap-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white transition-colors"
            >
              <Columns3 className="w-4 h-4" />
              Columns
            </button>
            {showColumnPicker && (
              <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 w-64 max-h-80 overflow-y-auto">
                <div className="p-3 border-b border-slate-700">
                  <p className="text-sm text-slate-400">Select columns</p>
                </div>
                <div className="p-2">
                  {AVAILABLE_COLUMNS.map(col => (
                    <label key={col.id} className="flex items-center gap-3 p-2 hover:bg-slate-700/50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={columns.includes(col.id)}
                        onChange={() => toggleColumn(col.id)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500"
                      />
                      <span className="text-white text-sm">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <select
            value={activeView?.id || ''}
            onChange={(e) => {
              const view = savedViews.find(v => v.id === e.target.value)
              if (view) applyView(view)
            }}
            className="bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white"
          >
            <option value="">Default View</option>
            {savedViews.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>

          <button
            onClick={() => setShowSaveViewModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            Save View
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <Eye className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No campaigns found</h2>
          <p className="text-slate-400">Connect a Meta account and sync your campaigns.</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 text-left text-sm text-slate-400 bg-slate-800/50">
                    <th className="px-4 py-3 w-10"></th>
                    {columns.map(colId => {
                      const col = AVAILABLE_COLUMNS.find(c => c.id === colId)
                      return (
                        <th key={colId} className="px-4 py-3 font-medium whitespace-nowrap">
                          {col?.label || colId}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {paginatedCampaigns.map(campaign => {
                    const ins = insights[campaign.campaign_id]
                    const isExpanded = expandedCampaigns.has(campaign.campaign_id)
                    const campaignAdsets = adsets[campaign.campaign_id] || []

                    return (
                      <>
                        <tr key={campaign.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                          <td className="px-4 py-3">
                            <button onClick={() => toggleCampaign(campaign)} className="p-1 hover:bg-slate-700 rounded">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </button>
                          </td>
                          {columns.map(colId => (
                            <td key={colId} className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {colId === 'name' && <Megaphone className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                                <span className={colId === 'name' ? 'text-white font-medium' : 'text-slate-300'}>
                                  {renderCellValue(campaign, ins, colId)}
                                </span>
                              </div>
                            </td>
                          ))}
                        </tr>

                        {isExpanded && campaignAdsets.map(adset => {
                          const adsetInsight = insights[adset.adset_id]
                          const isAdsetExpanded = expandedAdsets.has(adset.adset_id)
                          const adsetAds = ads[adset.adset_id] || []

                          return (
                            <>
                              <tr key={adset.id} className="border-b border-slate-700/30 bg-slate-900/30 hover:bg-slate-700/20 transition-colors">
                                <td className="px-4 py-2">
                                  <button onClick={() => toggleAdset(adset, campaign.meta_connection_id)} className="p-1 hover:bg-slate-700 rounded">
                                    {isAdsetExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                                  </button>
                                </td>
                                {columns.map(colId => (
                                  <td key={colId} className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                      {colId === 'name' && <Layers className="w-4 h-4 text-green-400 flex-shrink-0" />}
                                      <span className={colId === 'name' ? 'text-slate-200' : 'text-slate-400 text-sm'}>
                                        {renderCellValue(adset, adsetInsight, colId)}
                                      </span>
                                    </div>
                                  </td>
                                ))}
                              </tr>

                              {isAdsetExpanded && adsetAds.map(ad => {
                                const adInsight = insights[ad.ad_id]
                                return (
                                  <tr key={ad.id} className="border-b border-slate-700/20 bg-slate-900/50 hover:bg-slate-700/20 transition-colors">
                                    <td className="px-4 py-2"><span className="w-6 inline-block"></span></td>
                                    {columns.map(colId => (
                                      <td key={colId} className="px-4 py-2">
                                        <div className="flex items-center gap-2">
                                          {colId === 'name' && <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />}
                                          <span className={colId === 'name' ? 'text-slate-300 text-sm' : 'text-slate-500 text-sm'}>
                                            {renderCellValue(ad, adInsight, colId)}
                                          </span>
                                        </div>
                                      </td>
                                    ))}
                                  </tr>
                                )
                              })}
                            </>
                          )
                        })}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(parseInt(e.target.value)); setCurrentPage(1) }}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Page {currentPage} of {totalPages || 1}</span>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-white disabled:opacity-50 hover:bg-slate-700 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-white disabled:opacity-50 hover:bg-slate-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Save View Modal */}
      {showSaveViewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Save Current View</h2>
            <input
              type="text"
              placeholder="View name..."
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowSaveViewModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-2 transition-colors">Cancel</button>
              <button onClick={saveCurrentView} disabled={!newViewName.trim()} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg py-2 transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}

      {showColumnPicker && <div className="fixed inset-0 z-40" onClick={() => setShowColumnPicker(false)} />}
    </div>
  )
}

function MetricCard({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-400/10',
    green: 'text-green-400 bg-green-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
    yellow: 'text-yellow-400 bg-yellow-400/10',
    slate: 'text-slate-400 bg-slate-400/10',
    cyan: 'text-cyan-400 bg-cyan-400/10',
    pink: 'text-pink-400 bg-pink-400/10',
    orange: 'text-orange-400 bg-orange-400/10',
    emerald: 'text-emerald-400 bg-emerald-400/10',
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-400">{title}</p>
        <div className={`p-1.5 rounded-lg ${colorClasses[color] || colorClasses.slate}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  )
}
