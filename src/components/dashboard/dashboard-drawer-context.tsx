"use client"

import * as React from "react"

type DrawerContextValue = {
  open: boolean
  openDrawer: () => void
  closeDrawer: () => void
  toggleDrawer: () => void
}

const DashboardDrawerContext = React.createContext<DrawerContextValue | null>(null)

export function DashboardDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)

  const openDrawer = React.useCallback(() => setOpen(true), [])
  const closeDrawer = React.useCallback(() => setOpen(false), [])
  const toggleDrawer = React.useCallback(() => setOpen((v) => !v), [])

  const value = React.useMemo<DrawerContextValue>(
    () => ({ open, openDrawer, closeDrawer, toggleDrawer }),
    [open, openDrawer, closeDrawer, toggleDrawer],
  )
  return (
    <DashboardDrawerContext.Provider value={value}>
      {children}
    </DashboardDrawerContext.Provider>
  )
}

export function useDashboardDrawer(): DrawerContextValue {
  const ctx = React.useContext(DashboardDrawerContext)
  if (!ctx) {
    return {
      open: false,
      openDrawer: () => {},
      closeDrawer: () => {},
      toggleDrawer: () => {},
    }
  }
  return ctx
}
