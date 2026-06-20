import "server-only"

import { createClient } from "@/lib/supabase/server"
import { mapSpaSettings } from "@/lib/supabase/types"
import type { SpaSettings } from "@/lib/supabase/types"

export type SpaSettingsServerUpdate = {
  spaName?: string
  website?: string
  ownerName?: string
  ownerEmail?: string
  address?: string
}

export async function getSpaSettings(): Promise<SpaSettings | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("spa_settings")
    .select("*")
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapSpaSettings(data as Record<string, unknown>) : null
}
