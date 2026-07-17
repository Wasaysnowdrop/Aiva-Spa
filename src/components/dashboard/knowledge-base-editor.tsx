"use client"

import * as React from "react"
import {
  AlertTriangle,
  BookOpen,
  Bot,
  Check,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Tag,
  Trash2,
  Wand2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type {
  KnowledgeService,
  KnowledgeFaq,
  KnowledgeGuardrail,
  FaqCategory,
  KnowledgeCategory,
  GuardrailRuleType,
  WidgetConfig,
} from "@/lib/supabase/types"
import {
  GUARDRAIL_RULE_TYPES,
  GUARDRAIL_RULE_TYPE_LABELS,
} from "@/lib/supabase/types"
import { cn, formatDate } from "@/lib/utils"
import { useRealtimeSubscription } from "@/lib/hooks/use-realtime"
import {
  mapKnowledgeService,
  mapKnowledgeFaq,
  mapKnowledgeGuardrail,
} from "@/lib/supabase/types"
import { faqCategories as faqCategoryOptions } from "@/lib/db/knowledge"
import {
  createServiceAction,
  updateServiceAction,
  deleteServiceAction,
  toggleServiceActiveAction,
  createFaqAction,
  updateFaqAction,
  deleteFaqAction,
  toggleGuardrailAction,
  createGuardrailAction,
  updateGuardrailBodyAction,
  deleteGuardrailAction,
  updateConsentTextAction,
} from "@/app/actions/knowledge"
import { loadKnowledgeBaseAction } from "@/app/actions/knowledge-load"
import { toast } from "sonner"
import { SERVICE_CATEGORIES } from "@/lib/kb/service-categories"

const suggestedKnowledgeCategoryOptions: KnowledgeCategory[] = [...SERVICE_CATEGORIES]

type Tab = "services" | "faqs" | "rules"

function mergeById<T extends { id: string }>(serverRows: T[], prev: T[]): T[] {
  // Server rows are authoritative. Anything in `prev` that the server
  // didn't echo back is preserved so a transient admin-client hiccup
  // or a rate-limited response can never shrink the visible list.
  const byId = new Map<string, T>()
  for (const row of serverRows) byId.set(row.id, row)
  for (const row of prev) {
    if (!byId.has(row.id)) byId.set(row.id, row)
  }
  return Array.from(byId.values())
}

type ServiceDraft = {
  name: string
  category: KnowledgeCategory
  description: string
  pricingRule: string
  duration: string
  active: boolean
}

const emptyServiceDraft: ServiceDraft = {
  name: "",
  category: "Facials",
  description: "",
  pricingRule: "",
  duration: "",
  active: true,
}

type FaqDraft = {
  question: string
  answer: string
  category: FaqCategory
}

const emptyFaqDraft: FaqDraft = {
  question: "",
  answer: "",
  category: "General",
}

type GuardrailDraft = {
  title: string
  body: string
  description: string
  ruleType: GuardrailRuleType
  enabled: boolean
}

const emptyGuardrailDraft: GuardrailDraft = {
  title: "",
  body: "",
  description: "",
  ruleType: "general",
  enabled: true,
}

export function KnowledgeBaseEditor() {
  const [tab, setTab] = React.useState<Tab>("services")
  const [query, setQuery] = React.useState("")
  const [faqCategoryFilter, setFaqCategoryFilter] = React.useState<
    "All" | FaqCategory
  >("All")
  const [consentText, setConsentText] = React.useState<string | null>(null)
  const [widgetConfig, setWidgetConfig] = React.useState<WidgetConfig | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)

  const { data: services, setData: setServices, error: servicesError, lastEvent: servicesLastEvent, fetchCount: servicesFetchCount } = useRealtimeSubscription<KnowledgeService>({
    table: "knowledge_services",
    event: "INSERT",
    orderBy: { column: "name", ascending: true },
    mapRow: (row) => mapKnowledgeService(row),
    getId: (item) => item.id,
  })

  const { data: faqs, setData: setFaqs, lastEvent: faqsLastEvent, fetchCount: faqsFetchCount } = useRealtimeSubscription<KnowledgeFaq>({
    table: "knowledge_faqs",
    event: "INSERT",
    orderBy: { column: "created_at", ascending: true },
    mapRow: (row) => mapKnowledgeFaq(row),
    getId: (item) => item.id,
  })

  const { data: guardrails, setData: setGuardrails, lastEvent: guardrailsLastEvent, fetchCount: guardrailsFetchCount } = useRealtimeSubscription<KnowledgeGuardrail>({
    table: "knowledge_guardrails",
    event: "INSERT",
    orderBy: { column: "created_at", ascending: true },
    mapRow: (row) => mapKnowledgeGuardrail(row),
    getId: (item) => item.id,
  })

  // Authoritative re-fetch via server action (admin client) so the
  // dashboard never has to rely on a possibly-flaky browser-side
  // anon-key SELECT. The realtime subscription still runs and merges
  // any change, but it can't blow away the result of a successful
  // server fetch. The merge is a never-lose union: any locally
  // visible row that the server didn't return is preserved so a
  // transient admin-client hiccup can never make a row "vanish".
  const [lastServerFetchAt, setLastServerFetchAt] = React.useState<string | null>(null)
  const loadFromServer = React.useCallback(async () => {
    setRefreshing(true)
    try {
      const snap = await loadKnowledgeBaseAction()
      setServices((prev) => mergeById(snap.services, prev))
      setFaqs((prev) => mergeById(snap.faqs, prev))
      setGuardrails((prev) => mergeById(snap.guardrails, prev))
      setLastServerFetchAt(snap.fetchedAt)
      if (snap.status === "partial") {
        toast.error("Some knowledge-base data could not be refreshed. Your existing items are still shown.")
      } else if (snap.status === "rate_limited") {
        toast.error("Knowledge-base refresh is temporarily busy. Please try again shortly.")
      } else if (snap.status === "unauthenticated") {
        toast.error("Your session expired. Sign in again to refresh the knowledge base.")
      }
    } catch (e) {
      console.error("[kb] loadFromServer failed", e)
      toast.error(e instanceof Error ? e.message : "Failed to load knowledge base")
    } finally {
      setRefreshing(false)
    }
  }, [setServices, setFaqs, setGuardrails])

  React.useEffect(() => {
    // One-time authoritative fetch on mount; subsequent updates come
    // from the realtime subscription. The setState inside loadFromServer
    // is intentional and benign here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFromServer()
  }, [loadFromServer])


  const [activeFaqId, setActiveFaqId] = React.useState<string>(() => "")
  const resolvedActiveFaqId = activeFaqId || faqs[0]?.id || ""

  const [serviceDialog, setServiceDialog] = React.useState<{
    mode: "new" | "edit"
    draft: ServiceDraft
    id?: string
  } | null>(null)

  const [faqDialog, setFaqDialog] = React.useState<{
    mode: "new" | "edit"
    draft: FaqDraft
    id?: string
  } | null>(null)

  const [guardrailDialog, setGuardrailDialog] = React.useState<{
    mode: "new" | "edit"
    draft: GuardrailDraft
    id?: string
  } | null>(null)

  const [disclaimerOpen, setDisclaimerOpen] = React.useState(false)
  const [sandboxOpen, setSandboxOpen] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState<
    | { kind: "service"; id: string; name: string }
    | { kind: "faq"; id: string; question: string }
    | { kind: "guardrail"; id: string; title: string }
    | null
  >(null)

  const [serviceSaving, setServiceSaving] = React.useState(false)
  const [faqSaving, setFaqSaving] = React.useState(false)
  const [guardrailSaving, setGuardrailSaving] = React.useState(false)

  const onSaveService = async () => {
    if (!serviceDialog) return
    const { mode, draft, id } = serviceDialog
    if (!draft.name.trim()) {
      toast.error("Service name is required")
      return
    }
    const category = draft.category
    if (!category) {
      toast.error("Category is required")
      return
    }
    const payload = {
      name: draft.name.trim(),
      category,
      description: draft.description.trim(),
      pricingRule: draft.pricingRule.trim(),
      duration: draft.duration.trim(),
      active: draft.active,
    }
    if (process.env.NODE_ENV !== "production") {
      console.log("[kb] save service", { mode, payload })
    }
    setServiceSaving(true)
    try {
      const result =
        mode === "new"
          ? await createServiceAction(payload)
          : await updateServiceAction(id!, payload)
      if (!result.ok) {
        console.error("[kb] save service failed", { mode, payload, error: result.error })
        toast.error(result.error ?? "Save failed")
        return
      }
      toast.success(mode === "new" ? "Service added" : "Service updated")
      setServiceDialog(null)
      await loadFromServer()
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error"
      console.error("[kb] save service threw", { mode, payload, error: message })
      toast.error(message)
    } finally {
      setServiceSaving(false)
    }
  }

  const onSaveFaq = async () => {
    if (!faqDialog) return
    const { mode, draft, id } = faqDialog
    if (!draft.question.trim() || !draft.answer.trim()) {
      toast.error("Both question and answer are required")
      return
    }
    const payload = {
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      category: draft.category,
    }
    setFaqSaving(true)
    try {
      const result =
        mode === "new"
          ? await createFaqAction(payload)
          : await updateFaqAction(id!, payload)
      if (!result.ok) {
        console.error("[kb] save faq failed", { mode, payload, error: result.error })
        toast.error(result.error ?? "Save failed")
        return
      }
      toast.success(mode === "new" ? "FAQ added" : "FAQ updated")
      setFaqDialog(null)
      await loadFromServer()
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error"
      console.error("[kb] save faq threw", { mode, error: message })
      toast.error(message)
    } finally {
      setFaqSaving(false)
    }
  }

  const onSaveGuardrail = async () => {
    if (!guardrailDialog) return
    const { mode, draft, id } = guardrailDialog
    if (!draft.title.trim() || !draft.body.trim()) {
      toast.error("Title and body are required")
      return
    }
    const payload = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      description: draft.description.trim() || draft.body.trim(),
      ruleType: draft.ruleType,
      enabled: draft.enabled,
    }
    if (process.env.NODE_ENV !== "production") {
      console.log("[kb] save guardrail", { mode, payload })
    }
    setGuardrailSaving(true)
    try {
      const result =
        mode === "new"
          ? await createGuardrailAction(payload)
          : await updateGuardrailBodyAction(id!, payload)
      if (!result.ok) {
        console.error("[kb] save guardrail failed", { mode, payload, error: result.error })
        toast.error(result.error ?? "Save failed")
        return
      }
      toast.success(mode === "new" ? "Guardrail added" : "Guardrail updated")
      setGuardrailDialog(null)
      await loadFromServer()
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error"
      console.error("[kb] save guardrail threw", { mode, payload, error: message })
      toast.error(message)
    } finally {
      setGuardrailSaving(false)
    }
  }

  const onConfirmDelete = async () => {
    if (!confirmDelete) return
    if (confirmDelete.kind === "service") {
      const result = await deleteServiceAction(confirmDelete.id)
      if (!result.ok) {
        toast.error(result.error ?? "Delete failed")
        return
      }
      setServices((prev) => prev.filter((s) => s.id !== confirmDelete.id))
      toast.success("Service deleted")
    } else if (confirmDelete.kind === "faq") {
      const result = await deleteFaqAction(confirmDelete.id)
      if (!result.ok) {
        toast.error(result.error ?? "Delete failed")
        return
      }
      setFaqs((prev) => prev.filter((f) => f.id !== confirmDelete.id))
      if (activeFaqId === confirmDelete.id) setActiveFaqId("")
      toast.success("FAQ deleted")
    } else {
      const result = await deleteGuardrailAction(confirmDelete.id)
      if (!result.ok) {
        toast.error(result.error ?? "Delete failed")
        return
      }
      setGuardrails((prev) => prev.filter((g) => g.id !== confirmDelete.id))
      toast.success("Guardrail deleted")
    }
    setConfirmDelete(null)
    // Re-fetch from the server so the local state can never disagree
    // with what's actually in the database (defends against phantom
    // DELETE events from realtime and any stale UI).
    void loadFromServer()
  }

  const onToggleService = async (service: KnowledgeService) => {
    const next = !service.active
    setServices((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, active: next } : s)),
    )
    const result = await toggleServiceActiveAction(service.id, next)
    if (!result.ok) {
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, active: service.active } : s)),
      )
      toast.error(result.error ?? "Update failed")
      return
    }
    toast.success(next ? "Service published" : "Service hidden")
  }

  const onToggleGuardrail = async (g: KnowledgeGuardrail) => {
    const next = !g.enabled
    setGuardrails((prev) =>
      prev.map((x) => (x.id === g.id ? { ...x, enabled: next } : x)),
    )
    const result = await toggleGuardrailAction(g.id, next)
    if (!result.ok) {
      setGuardrails((prev) =>
        prev.map((x) => (x.id === g.id ? { ...x, enabled: g.enabled } : x)),
      )
      toast.error(result.error ?? "Update failed")
      return
    }
  }

  const onSaveDisclaimer = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) {
      toast.error("Text cannot be empty")
      return
    }
    const result = await updateConsentTextAction({ consentText: trimmed })
    if (!result.ok) {
      toast.error(result.error ?? "Save failed")
      return
    }
    setConsentText(trimmed)
    setWidgetConfig((prev) => (prev ? { ...prev, consentText: trimmed } : prev))
    toast.success("Consent text updated")
  }

  const filteredFaqs = faqs.filter((f) => {
    const matchesQ = f.question.toLowerCase().includes(query.toLowerCase())
    const matchesC =
      faqCategoryFilter === "All" ? true : f.category === faqCategoryFilter
    return matchesQ && matchesC
  })

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4">
        <nav className="rounded-2xl border border-[#23252A] bg-[#121316] p-2">
          {(
            [
              { v: "services" as const, label: "Services & pricing", count: services.length, icon: Sparkles },
              { v: "faqs" as const, label: "FAQs", count: faqs.length, icon: BookOpen },
              { v: "rules" as const, label: "Guardrails", count: guardrails.length, icon: AlertTriangle },
            ]
          ).map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.v}
                type="button"
                onClick={() => setTab(item.v)}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition",
                  tab === item.v
                    ? "bg-[#1A1B1E] text-[#F7F8F8]"
                    : "text-[#8A8F98] hover:bg-[#1A1B1E] hover:text-[#F7F8F8]",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 transition-colors",
                    tab === item.v ? "text-[#E2E54B]" : "text-[#8A8F98] group-hover:text-[#F7F8F8]",
                  )}
                />
                <span className="flex-1">{item.label}</span>
                <span className="rounded bg-[#0B0C0E] px-1.5 py-0.5 font-mono text-[10px] text-[#8A8F98]">
                  {item.count}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-4">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-[#5E6AD2]" />
            <p className="text-sm font-semibold text-[#F7F8F8]">How AI uses this</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-[#8A8F98]">
            AivaSpa answers strictly from your approved knowledge base. Update FAQs to teach the
            AI new questions, and edit guardrails to control what it never says.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={() => setSandboxOpen(true)}
          >
            <Wand2 className="size-4" /> Test in sandbox
          </Button>
        </div>

        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#F7F8F8]">Sync</p>
              <p className="mt-0.5 text-[10px] text-[#8A8F98]">
                {lastServerFetchAt
                  ? `Last server fetch: ${new Date(lastServerFetchAt).toLocaleTimeString()}`
                  : "Not loaded yet"}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => void loadFromServer()}
              disabled={refreshing}
              aria-label="Refresh from server"
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
          </div>
          {process.env.NODE_ENV !== "production" ? (
            <ul className="mt-3 space-y-1 font-mono text-[10px] text-[#62666D]">
              <li>
                services · fetch#{servicesFetchCount} · last:{" "}
                {servicesLastEvent?.eventType ?? "—"}
                {servicesLastEvent?.eventType === "DELETE"
                  ? ` id=${servicesLastEvent.id ?? "?"}`
                  : ""}
              </li>
              <li>
                faqs · fetch#{faqsFetchCount} · last:{" "}
                {faqsLastEvent?.eventType ?? "—"}
              </li>
              <li>
                guardrails · fetch#{guardrailsFetchCount} · last:{" "}
                {guardrailsLastEvent?.eventType ?? "—"}
              </li>
            </ul>
          ) : null}
        </div>
      </aside>

      <section className="flex flex-col gap-5">
        {tab === "services" && (
          <ServicesTab
            services={services}
            servicesError={servicesError}
            onNew={() =>
              setServiceDialog({ mode: "new", draft: { ...emptyServiceDraft } })
            }
            onEdit={(s) =>
              setServiceDialog({
                mode: "edit",
                id: s.id,
                draft: {
                  name: s.name,
                  category: s.category,
                  description: s.description,
                  pricingRule: s.pricingRule,
                  duration: s.duration,
                  active: s.active,
                },
              })
            }
            onDelete={(s) =>
              setConfirmDelete({ kind: "service", id: s.id, name: s.name })
            }
            onToggleActive={onToggleService}
            onRefresh={() => void loadFromServer()}
            refreshing={refreshing}
          />
        )}
        {tab === "faqs" && (
          <FaqsTab
            faqs={filteredFaqs}
            totalCount={faqs.length}
            query={query}
            setQuery={setQuery}
            activeId={resolvedActiveFaqId}
            setActiveId={setActiveFaqId}
            categoryFilter={faqCategoryFilter}
            setCategoryFilter={setFaqCategoryFilter}
            onNew={() =>
              setFaqDialog({ mode: "new", draft: { ...emptyFaqDraft } })
            }
            onEdit={(f) =>
              setFaqDialog({
                mode: "edit",
                id: f.id,
                draft: {
                  question: f.question,
                  answer: f.answer,
                  category: f.category,
                },
              })
            }
            onDelete={(f) =>
              setConfirmDelete({ kind: "faq", id: f.id, question: f.question })
            }
          />
        )}
        {tab === "rules" && (
          <GuardrailsTab
            guardrails={guardrails}
            onToggle={onToggleGuardrail}
            onEditDisclaimer={() => setDisclaimerOpen(true)}
            onAdd={() =>
              setGuardrailDialog({ mode: "new", draft: { ...emptyGuardrailDraft } })
            }
            onEdit={(g) =>
              setGuardrailDialog({
                mode: "edit",
                id: g.id,
                draft: {
                  title: g.title,
                  body: g.body || g.description,
                  description: g.description || g.body,
                  ruleType: g.ruleType,
                  enabled: g.enabled,
                },
              })
            }
            onDelete={(g) =>
              setConfirmDelete({ kind: "guardrail", id: g.id, title: g.title })
            }
          />
        )}
      </section>

      {serviceDialog ? (
        <ServiceDialog
          open
          mode={serviceDialog.mode}
          draft={serviceDialog.draft}
          setDraft={(d) =>
            setServiceDialog((cur) => (cur ? { ...cur, draft: d } : cur))
          }
          onClose={() => !serviceSaving && setServiceDialog(null)}
          onSave={onSaveService}
          saving={serviceSaving}
          categorySuggestions={Array.from(
            new Set([
              ...suggestedKnowledgeCategoryOptions,
              ...services.map((s) => s.category).filter(Boolean),
              serviceDialog.draft.category,
            ]),
          ).sort((a, b) => a.localeCompare(b))}
        />
      ) : null}

      {faqDialog ? (
        <FaqDialog
          open
          mode={faqDialog.mode}
          draft={faqDialog.draft}
          setDraft={(d) => setFaqDialog((cur) => (cur ? { ...cur, draft: d } : cur))}
          onClose={() => !faqSaving && setFaqDialog(null)}
          onSave={onSaveFaq}
          saving={faqSaving}
        />
      ) : null}

      {guardrailDialog ? (
        <GuardrailDialog
          open
          mode={guardrailDialog.mode}
          draft={guardrailDialog.draft}
          setDraft={(d) =>
            setGuardrailDialog((cur) => (cur ? { ...cur, draft: d } : cur))
          }
          onClose={() => !guardrailSaving && setGuardrailDialog(null)}
          onSave={onSaveGuardrail}
          saving={guardrailSaving}
        />
      ) : null}

      {disclaimerOpen ? (
        <DisclaimerDialog
          key="disclaimer"
          open
          initialText={consentText ?? widgetConfig?.consentText ?? ""}
          onClose={() => setDisclaimerOpen(false)}
          onSave={onSaveDisclaimer}
        />
      ) : null}

      {confirmDelete ? (
        <Dialog open onOpenChange={(o) => !o && setConfirmDelete(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Delete{" "}
                {confirmDelete.kind === "service"
                  ? "service"
                  : confirmDelete.kind === "faq"
                    ? "FAQ"
                    : "guardrail"}
                ?
              </DialogTitle>
              <DialogDescription>
                {confirmDelete.kind === "service"
                  ? `This will permanently remove "${confirmDelete.name}" from the AI's knowledge base.`
                  : confirmDelete.kind === "faq"
                    ? `This will permanently remove the FAQ "${confirmDelete.question}".`
                    : `This will permanently remove the guardrail "${confirmDelete.title}".`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#EB5757] text-white hover:bg-[#EB5757]/90"
                onClick={onConfirmDelete}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {sandboxOpen ? (
        <SandboxDialog
          open
          onClose={() => setSandboxOpen(false)}
          services={services}
          faqs={faqs}
          guardrails={guardrails}
        />
      ) : null}
    </div>
  )
}

function ServicesTab({
  services,
  servicesError,
  onNew,
  onEdit,
  onDelete,
  onToggleActive,
  onRefresh,
  refreshing,
}: {
  services: KnowledgeService[]
  servicesError?: Error | null
  onNew: () => void
  onEdit: (s: KnowledgeService) => void
  onDelete: (s: KnowledgeService) => void
  onToggleActive: (s: KnowledgeService) => void
  onRefresh?: () => void
  refreshing?: boolean
}) {
  return (
    <div className="rounded-2xl border border-[#23252A] bg-[#121316]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23252A] p-5">
        <div>
          <h2 className="text-base font-semibold text-[#F7F8F8]">Services & pricing rules</h2>
          <p className="mt-0.5 text-xs text-[#8A8F98]">
            What AivaSpa can quote or recommend. AivaSpa never quotes firm prices.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
          onClick={onNew}
        >
          <Plus className="size-4" />
          New service
        </Button>
      </div>
      {servicesError ? (
        <div className="border-b border-[#EB5757]/40 bg-[#EB5757]/10 px-5 py-3 text-xs text-[#F7F8F8]">
          <p className="font-semibold text-[#EB5757]">Could not load services from Supabase.</p>
          <p className="mt-1 text-[#8A8F98]">{servicesError.message}</p>
          <p className="mt-1 text-[10px] text-[#62666D]">
            If you just applied a migration, run supabase db push and reload. New rows are still
            being saved; they will appear here once the read path is healthy.
          </p>
        </div>
      ) : null}
      {services.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#8A8F98]">
          <p>No services yet. Click <span className="text-[#F7F8F8]">New service</span> to add one.</p>
          {onRefresh ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh from server
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="divide-y divide-[#23252A]">
          {services.map((service) => (
            <article
              key={service.id}
              className="grid grid-cols-1 gap-3 p-5 md:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#F7F8F8]">{service.name}</h3>
                  <span className="rounded-md border border-[#5E6AD2]/30 bg-[#5E6AD2]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8B95E0]">
                    {service.category}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleActive(service)}
                    aria-label={service.active ? "Hide service" : "Publish service"}
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition",
                      service.active
                        ? "border-[#4CB782]/30 bg-[#4CB782]/10 text-[#4CB782] hover:bg-[#4CB782]/20"
                        : "border-[#62666D]/30 bg-[#62666D]/10 text-[#62666D] hover:bg-[#62666D]/20",
                    )}
                  >
                    {service.active ? "Active" : "Hidden"}
                  </button>
                </div>
                {service.description ? (
                  <p className="mt-1 text-xs text-[#8A8F98]">{service.description}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[#8A8F98]">
                  {service.pricingRule ? (
                    <span className="flex items-center gap-1">
                      <Tag className="size-3" />
                      {service.pricingRule}
                    </span>
                  ) : null}
                  {service.duration ? (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {service.duration}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2 md:flex-col md:items-end">
                <Button variant="ghost" size="sm" onClick={() => onEdit(service)}>
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(service)}
                  className="text-[#EB5757] hover:bg-[#EB5757]/10 hover:text-[#EB5757]"
                >
                  <Trash2 className="size-4" /> Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function FaqsTab({
  faqs,
  totalCount,
  query,
  setQuery,
  activeId,
  setActiveId,
  categoryFilter,
  setCategoryFilter,
  onNew,
  onEdit,
  onDelete,
}: {
  faqs: KnowledgeFaq[]
  totalCount: number
  query: string
  setQuery: (v: string) => void
  activeId: string
  setActiveId: (v: string) => void
  categoryFilter: "All" | FaqCategory
  setCategoryFilter: (v: "All" | FaqCategory) => void
  onNew: () => void
  onEdit: (f: KnowledgeFaq) => void
  onDelete: (f: KnowledgeFaq) => void
}) {
  const active = faqs.find((f) => f.id === activeId) ?? faqs[0]

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="flex max-h-[640px] flex-col overflow-hidden rounded-2xl border border-[#23252A] bg-[#121316]">
        <div className="flex flex-col gap-2 border-b border-[#23252A] p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#62666D]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search FAQs…"
              className="h-9 w-full pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {(["All", ...faqCategoryOptions] as ("All" | FaqCategory)[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[10px] font-semibold transition",
                  categoryFilter === cat
                    ? "border-[#E2E54B]/40 bg-[#E2E54B]/10 text-[#E2E54B]"
                    : "border-[#23252A] bg-[#0B0C0E] text-[#8A8F98] hover:text-[#F7F8F8]",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-[#23252A]">
          {faqs.length === 0 ? (
            <li className="p-6 text-center text-xs text-[#8A8F98]">
              {totalCount === 0
                ? "No FAQs yet. Add one to get started."
                : "No FAQs match your filter."}
            </li>
          ) : (
            faqs.map((faq) => (
              <li key={faq.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(faq.id)}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 px-3 py-2.5 text-left transition",
                    active?.id === faq.id
                      ? "bg-[#1A1B1E]"
                      : "hover:bg-[#1A1B1E]/60",
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <p
                      className={cn(
                        "text-xs font-semibold",
                        active?.id === faq.id ? "text-[#E2E54B]" : "text-[#F7F8F8]",
                      )}
                    >
                      {faq.question}
                    </p>
                    <MoreHorizontal className="size-3.5 shrink-0 text-[#62666D]" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#62666D]">
                    <span className="rounded bg-[#0B0C0E] px-1 py-0.5">{faq.category}</span>
                    <span>{formatDate(faq.updatedAt)}</span>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-[#23252A] p-3">
          <Button
            size="sm"
            className="w-full bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
            onClick={onNew}
          >
            <Plus className="size-4" /> New FAQ
          </Button>
        </div>
      </div>

      {active ? (
        <FaqEditor
          key={active.id}
          faq={active}
          onEdit={() => onEdit(active)}
          onDelete={() => onDelete(active)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#23252A] bg-[#121316] p-8 text-center">
          <p className="text-sm text-[#8A8F98]">No FAQ selected.</p>
          <Button
            size="sm"
            className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
            onClick={onNew}
          >
            <Plus className="size-4" /> Add your first FAQ
          </Button>
        </div>
      )}
    </div>
  )
}

function FaqEditor({
  faq,
  onEdit,
  onDelete,
}: {
  faq: KnowledgeFaq
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#23252A] bg-[#121316] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#F7F8F8]">FAQ detail</h2>
          <p className="mt-0.5 text-xs text-[#8A8F98]">
            Updated {formatDate(faq.updatedAt)} · AivaSpa uses this answer verbatim
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-[#EB5757] hover:bg-[#EB5757]/10 hover:text-[#EB5757]">
            <Trash2 className="size-4" /> Delete
          </Button>
          <Button
            size="sm"
            className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
            onClick={onEdit}
          >
            <Pencil className="size-4" /> Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
            Question
          </label>
          <p className="rounded-md border border-[#23252A] bg-[#0B0C0E] px-3 py-2 text-sm text-[#F7F8F8]">
            {faq.question}
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
            Category
          </label>
          <p className="rounded-md border border-[#23252A] bg-[#0B0C0E] px-3 py-2 text-sm text-[#F7F8F8]">
            {faq.category}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
          Approved answer
        </label>
        <p className="whitespace-pre-wrap rounded-md border border-[#23252A] bg-[#0B0C0E] px-3 py-2 text-sm leading-6 text-[#F7F8F8]">
          {faq.answer}
        </p>
        <p className="text-[10px] text-[#62666D]">
          Tip: avoid firm prices and medical claims. Defer to a licensed provider during
          consultation.
        </p>
      </div>

      <div className="rounded-xl border border-[#5E6AD2]/30 bg-[#5E6AD2]/5 p-3 text-xs">
        <div className="flex items-center gap-2">
          <Bot className="size-3.5 text-[#5E6AD2]" />
          <p className="font-semibold text-[#F7F8F8]">How AivaSpa will answer</p>
        </div>
        <p className="mt-1.5 text-[#8A8F98]">
          When a visitor asks{" "}
          <span className="font-semibold text-[#F7F8F8]">&ldquo;{faq.question}&rdquo;</span>:
        </p>
        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-[#23252A] bg-[#0B0C0E] p-2.5 text-[#F7F8F8]">
          {faq.answer}
        </p>
      </div>
    </div>
  )
}

function GuardrailsTab({
  guardrails,
  onToggle,
  onEditDisclaimer,
  onAdd,
  onEdit,
  onDelete,
}: {
  guardrails: KnowledgeGuardrail[]
  onToggle: (g: KnowledgeGuardrail) => void
  onEditDisclaimer: () => void
  onAdd: () => void
  onEdit: (g: KnowledgeGuardrail) => void
  onDelete: (g: KnowledgeGuardrail) => void
}) {
  return (
    <div className="rounded-2xl border border-[#23252A] bg-[#121316]">
      <div className="flex items-start justify-between gap-3 border-b border-[#23252A] p-5">
        <div>
          <h2 className="text-base font-semibold text-[#F7F8F8]">Guardrails</h2>
          <p className="mt-0.5 text-xs text-[#8A8F98]">
            AivaSpa must never act as a medical provider. Toggle rules on or off — changes
            apply immediately.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
          onClick={onAdd}
        >
          <Plus className="size-4" /> New guardrail
        </Button>
      </div>
      {guardrails.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#8A8F98]">
          No guardrails configured. Click <span className="text-[#F7F8F8]">New guardrail</span>{" "}
          to add one.
        </div>
      ) : (
        <ul className="divide-y divide-[#23252A]">
          {guardrails.map((g) => (
            <li key={g.id} className="flex items-start gap-3 p-5">
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
                  g.enabled
                    ? "border-[#4CB782]/40 bg-[#4CB782]/10 text-[#4CB782]"
                    : "border-[#23252A] bg-[#0B0C0E] text-[#62666D]",
                )}
              >
                <AlertTriangle className="size-4" />
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#F7F8F8]">{g.title}</p>
                  <span className="rounded-md border border-[#5E6AD2]/30 bg-[#5E6AD2]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8B95E0]">
                    {GUARDRAIL_RULE_TYPE_LABELS[g.ruleType] ?? g.ruleType}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#8A8F98]">
                  {g.description || g.body}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${g.title}`}
                  onClick={() => onEdit(g)}
                  className="size-8 text-[#8A8F98] hover:text-[#F7F8F8]"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${g.title}`}
                  onClick={() => onDelete(g)}
                  className="size-8 text-[#8A8F98] hover:text-[#EB5757]"
                >
                  <Trash2 className="size-4" />
                </Button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={g.enabled}
                  aria-label={`${g.enabled ? "Disable" : "Enable"} ${g.title}`}
                  onClick={() => onToggle(g)}
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full border transition",
                    g.enabled ? "border-[#4CB782]/50 bg-[#4CB782]" : "border-[#23252A] bg-[#1A1B1E]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-3.5 rounded-full bg-[#F7F8F8] transition-all",
                      g.enabled ? "left-[18px]" : "left-0.5",
                    )}
                  />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-[#23252A] p-5">
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#23252A] bg-[#0B0C0E] p-4">
          <FileText className="size-5 text-[#8A8F98]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#F7F8F8]">Consent text</p>
            <p className="text-xs text-[#8A8F98]">
              Shown to visitors before their details are saved. Must link to your privacy
              policy.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onEditDisclaimer}>
            <Pencil className="size-4" /> Edit
          </Button>
        </div>
      </div>
    </div>
  )
}

function ServiceDialog({
  open,
  mode,
  draft,
  setDraft,
  onClose,
  onSave,
  saving,
  categorySuggestions,
}: {
  open: boolean
  mode: "new" | "edit"
  draft: ServiceDraft
  setDraft: (d: ServiceDraft) => void
  onClose: () => void
  onSave: () => void
  saving?: boolean
  categorySuggestions: KnowledgeCategory[]
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "new" ? "New service" : "Edit service"}</DialogTitle>
          <DialogDescription>
            What AivaSpa can recommend. Pricing is never quoted to visitors — it&apos;s
            always confirmed at consultation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="svc-name">Name</Label>
            <Input
              id="svc-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Botox"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-cat">Category</Label>
            <Input
              id="svc-cat"
              list="kb-category-suggestions"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as KnowledgeCategory })}
              placeholder="e.g. Facials"
              maxLength={80}
              autoComplete="off"
            />
            <datalist id="kb-category-suggestions">
              {categorySuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <p className="text-[10px] text-[#62666D]">
              Pick a suggestion or type your own (e.g. Facials, Wellness, Hair Removal).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc-dur">Duration</Label>
            <Input
              id="svc-dur"
              value={draft.duration}
              onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
              placeholder="e.g. 30 min"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="svc-desc">Description</Label>
            <Textarea
              id="svc-desc"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="What is this treatment, who is it for, what to expect…"
              className="min-h-20"
              maxLength={2000}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="svc-pricing">Pricing rule</Label>
            <Input
              id="svc-pricing"
              value={draft.pricingRule}
              onChange={(e) => setDraft({ ...draft, pricingRule: e.target.value })}
              placeholder="e.g. Per unit, confirmed at consultation"
              maxLength={200}
            />
            <p className="text-[10px] text-[#62666D]">
              AivaSpa will never quote this as a firm number to visitors.
            </p>
          </div>
          <label className="md:col-span-2 flex items-center gap-2 text-xs text-[#F7F8F8]">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              className="size-3.5 accent-[#E2E54B]"
            />
            Active (visible to AivaSpa when answering questions)
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}{" "}
            {mode === "new" ? "Add service" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FaqDialog({
  open,
  mode,
  draft,
  setDraft,
  onClose,
  onSave,
  saving,
}: {
  open: boolean
  mode: "new" | "edit"
  draft: FaqDraft
  setDraft: (d: FaqDraft) => void
  onClose: () => void
  onSave: () => void
  saving?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "new" ? "New FAQ" : "Edit FAQ"}</DialogTitle>
          <DialogDescription>
            Questions visitors actually ask. AivaSpa uses the answer verbatim and cites this
            row in its retrieval.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="faq-q">Question</Label>
            <Input
              id="faq-q"
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
              placeholder="e.g. Do you offer Botox?"
              maxLength={500}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="faq-c">Category</Label>
            <Select
              value={draft.category}
              onValueChange={(v) => setDraft({ ...draft, category: v as FaqCategory })}
            >
              <SelectTrigger id="faq-c" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {faqCategoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="faq-a">Approved answer</Label>
          <Textarea
            id="faq-a"
            value={draft.answer}
            onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
            placeholder="The exact reply AivaSpa should give. Avoid firm prices and medical claims."
            className="min-h-32"
            maxLength={4000}
          />
          <p className="text-[10px] text-[#62666D]">
            Tip: avoid firm prices and medical claims. Defer to a licensed provider during
            consultation.
          </p>
        </div>
        {draft.question ? (
          <div className="rounded-xl border border-[#5E6AD2]/30 bg-[#5E6AD2]/5 p-3 text-xs">
            <div className="flex items-center gap-2">
              <Bot className="size-3.5 text-[#5E6AD2]" />
              <p className="font-semibold text-[#F7F8F8]">AI preview</p>
            </div>
            <p className="mt-1.5 text-[#8A8F98]">
              When a visitor asks{" "}
              <span className="font-semibold text-[#F7F8F8]">&ldquo;{draft.question}&rdquo;</span>:
            </p>
            <p className="mt-2 whitespace-pre-wrap rounded-lg border border-[#23252A] bg-[#0B0C0E] p-2.5 text-[#F7F8F8]">
              {draft.answer || "(your answer will appear here)"}
            </p>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}{" "}
            {mode === "new" ? "Add FAQ" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GuardrailDialog({
  open,
  mode,
  draft,
  setDraft,
  onClose,
  onSave,
  saving,
}: {
  open: boolean
  mode: "new" | "edit"
  draft: GuardrailDraft
  setDraft: (d: GuardrailDraft) => void
  onClose: () => void
  onSave: () => void
  saving?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "new" ? "New guardrail" : "Edit guardrail"}
          </DialogTitle>
          <DialogDescription>
            Safety rules AivaSpa must always follow. Disabled guardrails are saved but
            ignored.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="g-title">Title</Label>
            <Input
              id="g-title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Never prescribe medication"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-type">Rule type</Label>
            <Select
              value={draft.ruleType}
              onValueChange={(v) =>
                setDraft({ ...draft, ruleType: v as GuardrailRuleType })
              }
            >
              <SelectTrigger id="g-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GUARDRAIL_RULE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {GUARDRAIL_RULE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-body">Rule</Label>
          <Textarea
            id="g-body"
            value={draft.body}
            onChange={(e) =>
              setDraft({ ...draft, body: e.target.value, description: e.target.value })
            }
            placeholder="Describe what AivaSpa must never do."
            className="min-h-28"
            maxLength={2000}
          />
          <p className="text-[10px] text-[#62666D]">
            Plain-English rule. AivaSpa reads this verbatim during safety checks.
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs text-[#8A8F98]">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              className="size-3.5 accent-[#E2E54B]"
            />
            Enabled (AivaSpa enforces this rule)
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}{" "}
            {mode === "new" ? "Add guardrail" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SandboxDialog({
  open,
  onClose,
  services,
  faqs,
  guardrails,
}: {
  open: boolean
  onClose: () => void
  services: KnowledgeService[]
  faqs: KnowledgeFaq[]
  guardrails: KnowledgeGuardrail[]
}) {
  const [input, setInput] = React.useState("")
  const [messages, setMessages] = React.useState<
    { role: "user" | "ai"; content: string; at: string }[]
  >([])
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  const summary = `${services.length} services · ${faqs.length} FAQs · ${guardrails.filter((g) => g.enabled).length}/${guardrails.length} guardrails on`

  async function send() {
    const trimmed = input.trim()
    if (!trimmed) return
    setInput("")
    setError(null)
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed, at: new Date().toLocaleTimeString() },
    ])
    setSending(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationType: "test",
          channel: "dashboard_internal",
          environment: "test",
          sessionId: `sandbox_${Date.now()}`,
          message: trimmed,
          history: messages.map((m) => ({
            role: m.role === "ai" ? "assistant" : "user",
            content: m.content,
          })),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
      }
      const data = (await res.json()) as { reply: string; provider: string; model: string }
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: data.reply, at: new Date().toLocaleTimeString() },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sandbox error")
    } finally {
      setSending(false)
    }
  }

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, sending])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-4 text-[#5E6AD2]" />
            Sandbox — test your knowledge base
          </DialogTitle>
          <DialogDescription>
            AivaSpa will answer using your current knowledge base ({summary}). Nothing is
            saved.
          </DialogDescription>
        </DialogHeader>
        <div
          ref={scrollRef}
          className="max-h-[400px] min-h-[200px] overflow-y-auto rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3"
        >
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 text-center text-xs text-[#8A8F98]">
              <Sparkles className="size-4 text-[#E2E54B]" />
              <p>Ask a treatment question, then edit the KB and test again.</p>
              <p className="text-[10px] text-[#62666D]">
                Try: &ldquo;Do you offer Botox?&rdquo; or &ldquo;How much is a facial?&rdquo;
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {messages.map((m, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-6",
                      m.role === "user"
                        ? "rounded-br-sm bg-[#E2E54B] text-[#08090A]"
                        : "rounded-bl-sm border border-[#23252A] bg-[#121316] text-[#F7F8F8]",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p
                      className={cn(
                        "mt-1 text-[10px]",
                        m.role === "user" ? "text-[#08090A]/60" : "text-[#62666D]",
                      )}
                    >
                      {m.role === "user" ? "You" : "AivaSpa"} · {m.at}
                    </p>
                  </div>
                </li>
              ))}
              {sending ? (
                <li className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm border border-[#23252A] bg-[#121316] px-3 py-2 text-xs text-[#8A8F98]">
                    AivaSpa is thinking…
                  </div>
                </li>
              ) : null}
            </ul>
          )}
        </div>
        {error ? <p className="text-[10px] text-[#EB5757]">{error}</p> : null}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder="Ask anything…"
            className="min-h-10 max-h-32 flex-1 resize-none"
            maxLength={2000}
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || input.trim().length === 0}
            className="size-10 shrink-0 bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
            aria-label="Send"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            <X className="size-4" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DisclaimerDialog({
  open,
  initialText,
  onClose,
  onSave,
}: {
  open: boolean
  initialText: string
  onClose: () => void
  onSave: (text: string) => Promise<void>
}) {
  const [draft, setDraft] = React.useState(initialText)
  const [saving, setSaving] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit consent text</DialogTitle>
          <DialogDescription>
            Shown to visitors before their details are saved. Include a link to your
            privacy policy.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="consent">Consent message</Label>
          <Textarea
            id="consent"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-28"
            maxLength={2000}
          />
          <p className="text-[10px] text-[#62666D]">
            Note: the first-reply disclaimer is always appended by the AI engine and is
            configured in the AI prompt.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              try {
                await onSave(draft)
                onClose()
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
