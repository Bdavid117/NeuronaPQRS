import { Suspense } from "react";
import { ChatPageInner } from "./ChatPageInner";

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatPageSkeleton />}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageSkeleton() {
  return (
    <div className="flex h-screen bg-surface-alt items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
    </div>
  );
}
