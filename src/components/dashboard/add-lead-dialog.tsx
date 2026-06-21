"use client"

import * as React from "react"
import { Loader2, Plus, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createLeadAction } from "@/app/actions/leads"
import { toast } from "sonner"

const SERVICE_OPTIONS = [
  "Botox",
  "Fillers",
  "Laser",
  "Facials",
  "Microneedling",
  "Consultation",
  "Other",
] as const

const SOURCE_OPTIONS = [
  { value: "Direct Link", label: "Direct / manual" },
  { value: "Website Chat", label: "Website chat" },
  { value: "Mobile", label: "Mobile" },
] as const

type AddLeadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (leadId: string) => void
}

export function AddLeadDialog({ open, onOpenChange, onCreated }: AddLeadDialogProps) {
  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [service, setService] = React.useState<string>("Botox")
  const [preferredTime, setPreferredTime] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [source, setSource] = React.useState<string>("Direct Link")
  const [consentGiven, setConsentGiven] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const resetForm = React.useCallback(() => {
    setName("")
    setPhone("")
    setEmail("")
    setService("Botox")
    setPreferredTime("")
    setNotes("")
    setSource("Direct Link")
    setConsentGiven(true)
    setError(null)
  }, [])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    if (!phone.trim()) {
      setError("Phone is required")
      return
    }
    if (!service.trim()) {
      setError("Service is required")
      return
    }

    setSubmitting(true)
    try {
      const result = await createLeadAction({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        service: service.trim(),
        preferredTime: preferredTime.trim() || undefined,
        notes: notes.trim() || undefined,
        source: source as "Website Chat" | "Mobile" | "Direct Link",
        consentGiven,
      })
      if (!result.ok) {
        setError(result.error ?? "Failed to add lead")
        toast.error(result.error ?? "Failed to add lead")
        return
      }
      toast.success(`Lead added: ${result.data.name}`)
      onCreated?.(result.data.id)
      resetForm()
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add lead"
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-[#E2E54B]" />
            Add lead manually
          </DialogTitle>
          <DialogDescription>
            Capture a lead from a phone call, walk-in, or any source outside the
            chat widget. They&apos;ll show up in your inbox right away.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="add-lead-name">Name *</Label>
              <Input
                id="add-lead-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jamie Rivera"
                autoComplete="name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-lead-phone">Phone *</Label>
              <Input
                id="add-lead-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(415) 555-0100"
                autoComplete="tel"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-lead-email">Email</Label>
              <Input
                id="add-lead-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jamie@example.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-lead-service">Service *</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger id="add-lead-service" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-lead-source">Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="add-lead-source" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="add-lead-time">Preferred time</Label>
              <Input
                id="add-lead-time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                placeholder="Weekday evenings"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="add-lead-notes">Notes</Label>
              <Textarea
                id="add-lead-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Referred by Alex. Mentioned birthday promo."
                className="min-h-20"
              />
            </div>
            <label className="flex items-center gap-2 sm:col-span-2 text-xs text-[#8A8F98]">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="size-3.5 rounded border-[#23252A] bg-[#121316] accent-[#E2E54B]"
              />
              I have explicit consent to contact this person about their inquiry.
            </label>
          </div>

          {error ? (
            <p className="rounded-lg border border-[#EB5757]/30 bg-[#EB5757]/10 px-3 py-2 text-xs text-[#F7F8F8]">
              {error}
            </p>
          ) : null}

          <DialogFooter showCloseButton={false}>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Adding…
                </>
              ) : (
                <>
                  <Plus className="size-4" /> Add lead
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
