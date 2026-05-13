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
  intake:       { label: "Recepción",    color: "text-blue-600",   dot: "bg-blue-500" },
  classifier:   { label: "Clasificador", color: "text-violet-600", dot: "bg-violet-500" },
  vision:       { label: "Verificación", color: "text-amber-600",  dot: "bg-amber-500" },
  resolver:     { label: "Resolución",   color: "text-emerald-600",dot: "bg-emerald-500" },
  resolver_auto:{ label: "Auto-Res.",    color: "text-teal-600",   dot: "bg-teal-500" },
  escalator:    { label: "Escalamiento", color: "text-rose-600",   dot: "bg-rose-500" },
};

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const agent = message.agentName ? AGENT_META[message.agentName] : null;

  return (
    <div className={cn("flex gap-3 items-start", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm",
        isUser
          ? "bg-primary-600"
          : "bg-slate-100 dark:bg-white/[0.08] border border-slate-200 dark:border-white/10"
      )}>
        {isUser
          ? <User size={14} className="text-white" />
          : <Bot size={14} className="text-slate-400 dark:text-white/50" />}
      </div>

      {/* Bubble + meta */}
      <div className={cn("max-w-[78%] flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
        {/* Agent label */}
        {!isUser && agent && (
          <div className="flex items-center gap-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", agent.dot)} />
            <span className={cn("text-[11px] font-semibold uppercase tracking-widest", agent.color)}>
              {agent.label}
            </span>
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          "px-4 py-3 text-sm leading-relaxed break-words",
          isUser
            ? "bg-primary-600 text-white rounded-2xl rounded-tr-sm shadow-sm"
            : "bg-white dark:bg-white/[0.07] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-white/[0.08] rounded-2xl rounded-tl-sm"
        )}>
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <div className="prose prose-slate dark:prose-invert prose-sm max-w-none
              prose-p:my-1 prose-p:leading-relaxed
              prose-strong:text-slate-900 dark:prose-strong:text-white prose-strong:font-semibold
              prose-ul:my-1.5 prose-ul:pl-4
              prose-ol:my-1.5 prose-ol:pl-4
              prose-li:my-0.5
              prose-code:bg-slate-100 dark:prose-code:bg-white/10 prose-code:text-slate-700 dark:prose-code:text-slate-200 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
              prose-blockquote:border-l-2 prose-blockquote:border-primary-400/60 prose-blockquote:pl-3 prose-blockquote:text-slate-500 dark:prose-blockquote:text-white/50
              prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
              prose-hr:border-slate-200 dark:prose-hr:border-white/10">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-slate-400 dark:bg-white/50 animate-pulse rounded-sm align-middle" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
