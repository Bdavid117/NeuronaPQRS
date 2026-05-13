"use client";

import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  isStreaming?: boolean;
}

const AGENT_META: Record<string, { label: string; color: string; dot: string }> = {
  intake:     { label: "Recepción",    color: "text-blue-400",   dot: "bg-blue-400" },
  classifier: { label: "Clasificador", color: "text-violet-400", dot: "bg-violet-400" },
  vision:     { label: "Verificación", color: "text-amber-400",  dot: "bg-amber-400" },
  resolver:   { label: "Resolución",   color: "text-emerald-400",dot: "bg-emerald-400" },
  escalator:  { label: "Escalamiento", color: "text-rose-400",   dot: "bg-rose-400" },
};

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const agent = message.agentName ? AGENT_META[message.agentName] : null;

  return (
    <div className={cn("flex gap-3 items-start group", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center shadow-lg",
        isUser
          ? "bg-gradient-to-br from-indigo-500 to-violet-600"
          : "bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10"
      )}>
        {isUser
          ? <User size={16} className="text-white" />
          : <Bot size={16} className="text-white/80" />}
      </div>

      {/* Bubble + meta */}
      <div className={cn("max-w-[78%] flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
        {/* Agent label */}
        {!isUser && agent && (
          <div className="flex items-center gap-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full", agent.dot)} />
            <span className={cn("text-[11px] font-semibold uppercase tracking-widest", agent.color)}>
              {agent.label}
            </span>
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          "px-4 py-3 text-sm leading-relaxed break-words shadow-md",
          isUser
            ? "bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-2xl rounded-tr-sm"
            : "bg-white/[0.07] backdrop-blur-sm text-white/90 border border-white/10 rounded-2xl rounded-tl-sm"
        )}>
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none
              prose-p:my-1 prose-p:leading-relaxed
              prose-strong:text-white prose-strong:font-semibold
              prose-em:text-white/80
              prose-ul:my-1.5 prose-ul:pl-4
              prose-ol:my-1.5 prose-ol:pl-4
              prose-li:my-0.5
              prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
              prose-blockquote:border-l-2 prose-blockquote:border-indigo-400 prose-blockquote:pl-3 prose-blockquote:text-white/60
              prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
              prose-hr:border-white/10">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-white/60 animate-pulse rounded-sm align-middle" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
