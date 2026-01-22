// src/sanity/tools/dashboard/index.tsx

import { definePlugin } from 'sanity'
import { BarChartIcon } from '@sanity/icons'
import { DashboardTool } from './DashboardTool'

export const dashboardTool = definePlugin({
  name: 'dashboard-tool',
  tools: [
    {
      name: 'dashboard',
      title: 'Dashboard',
      icon: BarChartIcon,
      component: DashboardTool,
    },
  ],
})
