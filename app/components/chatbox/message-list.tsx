import { useScrollToBottom } from "@/app/hooks/use-scroll-to-bottom"
import { MessageItem } from "./message-item"
import { Message } from "./types"

export const MessageList: React.FC<{ messages: Message[] }> = ({ messages }) => {
  const [containerRef, endRef] = useScrollToBottom<HTMLDivElement>()
  return (
    <div className="space-y-4 p-4" ref={containerRef}>
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
      <div ref={endRef} style={{ height: '1px' }} />
    </div>
  )
}
