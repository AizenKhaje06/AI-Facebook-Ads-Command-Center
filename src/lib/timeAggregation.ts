export type TimeAggregation = 'daily' | 'weekly' | 'monthly'

export function aggregateByPeriod(
  data: any[],
  period: TimeAggregation
): any[] {
  if (!data || data.length === 0) return []

  const periodMap = new Map<string, any>()

  data.forEach(point => {
    const date = new Date(point.date)
    let key: string
    let label: string

    switch (period) {
      case 'daily':
        key = point.date
        label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        break

      case 'weekly':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().split('T')[0]
        label = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        break

      case 'monthly':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
        label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        break

      default:
        key = point.date
        label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    if (!periodMap.has(key)) {
      periodMap.set(key, {
        date: key,
        label,
        spend: 0,
        revenue: 0,
        purchase_value: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        add_to_cart: 0,
        checkout: 0,
        leads: 0,
        purchases: 0,
        video_p100_watched: 0,
        reach: 0,
        frequency_sum: 0,
        point_count: 0,
      })
    }

    const agg = periodMap.get(key)
    agg.spend += point.spend || 0
    agg.revenue += point.purchase_value || point.revenue || 0
    agg.purchase_value += point.purchase_value || point.revenue || 0
    agg.clicks += point.clicks || 0
    agg.impressions += point.impressions || 0
    agg.conversions += point.conversions || 0
    agg.add_to_cart += point.add_to_cart || 0
    agg.checkout += point.checkout || 0
    agg.leads += point.leads || 0
    agg.purchases += point.purchases || 0
    agg.video_p100_watched += point.video_p100_watched || 0
    agg.reach += point.reach || 0
    agg.frequency_sum += point.frequency || 0
    agg.point_count += 1
  })

  return Array.from(periodMap.values())
    .map(item => ({
      ...item,
      frequency: item.point_count > 0 ? item.frequency_sum / item.point_count : 0,
      ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
      cpa: item.conversions > 0 ? item.spend / item.conversions : 0,
      roas: item.spend > 0 ? item.purchase_value / item.spend : 0,
      cpc: item.clicks > 0 ? item.spend / item.clicks : 0,
      cpm: item.impressions > 0 ? (item.spend / item.impressions) * 1000 : 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export function getChartDateRange(startDate: string, endDate: string): { start: Date; end: Date } {
  return {
    start: new Date(startDate),
    end: new Date(endDate)
  }
}
