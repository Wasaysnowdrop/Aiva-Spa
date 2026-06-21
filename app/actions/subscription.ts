"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { checkActionLimit } from "@/lib/security/check-action-limit"
import { LIMITS } from "@/lib/security/limits"
import {
  activatePaidPlan,
  dismissTrialPopup,
  ensureTrialSubscription,
} from "@/lib/subscription"
import { PLANS, type PlanId } from "@/lib/subscription/plans"

export type CheckoutResult = {
  ok: boolean
  error?: string
  plan?: PlanId
}

function readInterval(formData: FormData): "monthly" | "yearly" {
  const raw = formData.get("interval")
  return raw === "yearly" ? "yearly" : "monthly"
}

function readPlanId(formData: FormData): PlanId | null {
  const raw = String(formData.get("plan") ?? "")
  if (raw in PLANS) return raw as PlanId
  return null
}

export async function startTrial(): Promise<CheckoutResult> {
  const limit = await checkActionLimit(LIMITS.actionSubscription)
  if (!limit.ok) return { ok: false, error: limit.error }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }
  try {
    await ensureTrialSubscription(user.id)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not start trial.",
    }
  }
  revalidatePath("/dashboard")
  return { ok: true, plan: "starter" }
}

export async function fakeCheckout(formData: FormData): Promise<CheckoutResult> {
  const limit = await checkActionLimit(LIMITS.actionSubscription)
  if (!limit.ok) return { ok: false, error: limit.error }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  const planId = readPlanId(formData)
  if (!planId) {
    return { ok: false, error: "Please pick a valid plan." }
  }
  const interval = readInterval(formData)

  // Validate the (fake) card form
  const cardName = String(formData.get("cardName") ?? "").trim()
  const cardNumber = String(formData.get("cardNumber") ?? "").replace(/\s+/g, "")
  const cardExpiry = String(formData.get("cardExpiry") ?? "").trim()
  const cardCvc = String(formData.get("cardCvc") ?? "").trim()
  const cardLast4 = cardNumber.slice(-4) || "4242"

  if (!cardName || cardNumber.length < 12 || !cardExpiry || cardCvc.length < 3) {
    return {
      ok: false,
      error: "Please complete the fake card details (any test value works).",
    }
  }

  // Simulate payment latency
  await new Promise((resolve) => setTimeout(resolve, 600))

  const result = await activatePaidPlan(user.id, planId, interval, cardLast4)
  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  revalidatePath("/dashboard")
  revalidatePath("/pricing")

  return { ok: true, plan: result.plan }
}

export async function cancelSubscription(): Promise<CheckoutResult> {
  const limit = await checkActionLimit(LIMITS.actionSubscription)
  if (!limit.ok) return { ok: false, error: limit.error }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    } as never)
    .eq("user_id", user.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/settings")
  return { ok: true }
}

export async function dismissTrialPopupAction(): Promise<void> {
  const limit = await checkActionLimit(LIMITS.actionSubscription)
  if (!limit.ok) return
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await dismissTrialPopup(user.id)
  revalidatePath("/dashboard")
}
