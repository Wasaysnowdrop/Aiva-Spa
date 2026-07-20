import { AdminPageBody, AdminPageHeader } from "@/components/admin/page-header"
import { AdminConversationsTable } from "@/components/admin/operations-tables"
import { getOperationsData } from "@/lib/admin/control-centre"
export const dynamic = "force-dynamic"
export default async function AdminConversationsPage() { const data=await getOperationsData(); return <><AdminPageHeader title="Conversations" description="Production, onboarding, internal, test, and billable classifications without transcript exposure." generatedAt={new Date().toISOString()} /><AdminPageBody><AdminConversationsTable rows={data.conversations} /></AdminPageBody></> }