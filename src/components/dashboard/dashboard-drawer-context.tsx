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
  const value = React.useMemo<DrawerContextValue>(
    () => ({
      open,
      openDrawer: () => setOpen(true),
      closeDrawer: () => setOpen(false),
      toggleDrawer: () => setOpen((v) => !v),
    }),
    [open],
  )
  return (
    <DashboardDrawerContext.Provider value={value}>
      {children}
    </DashboardDrawerContext.Provider>
  )
}

export function useDashboardDrawer(): DrawerContextValue {
  const ctx = React.useContext(DashboardDrawerContext)
  // Fall back to a no-op set so components rendered outside the
  // provider (e.g. an isolated test) never crash.
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
