'use client'

import { createContext, useContext } from 'react'
import {
  defaultSiteSettings,
  type SiteSettings,
} from '@/lib/site-settings'

const SiteSettingsContext = createContext<SiteSettings>(defaultSiteSettings)

interface SiteSettingsProviderProps {
  children: React.ReactNode
  value: SiteSettings
}

export default function SiteSettingsProvider({
  children,
  value,
}: SiteSettingsProviderProps) {
  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  )
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext)
}
