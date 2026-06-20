import { AdminTopBar } from "@/components/admin/admin-shell"
import { getRecentChats } from "@/lib/admin/queries"

import { ConversationsTable, type ChatRow } from "./conversations-table"

export const dynamic = "force-dynamic"

export default async function AdminConversationsPage() {
  const chats = (await getRecentChats(200)) as ChatRow[]

  return (
    <>
      <AdminTopBar
        title="Conversations"
        subtitle={`${chats.length} most recent chat sessions`}
      />
      <div className="p-5">
        <ConversationsTable rows={chats} pageSize={50} empty="No chat sessions yet." />
      </div>
    </>
  )
}
