export type SSEEventType = "delta" | "agent_switch" | "tool_call" | "state" | "error" | "done";

export interface SSEPayload {
  event: SSEEventType;
  data: unknown;
}

export interface DeltaData { text: string }
export interface AgentSwitchData { agent: string }
export interface StateData {
  radicado?: string;
  tipo?: string;
  categoria?: string;
  urgencia?: string;
  plazo?: string;
  area?: string;
  case_url?: string;
  requires_human?: boolean;
  confidence?: number;
}

export interface DoneData {
  session_id: string;
}

export async function* streamChat(
  sessionId: string,
  message: string,
  attachmentIds: number[] = [],
  signal?: AbortSignal
): AsyncGenerator<SSEPayload> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const response = await fetch(`${apiUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message, attachment_ids: attachmentIds }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      try {
        yield JSON.parse(raw) as SSEPayload;
      } catch {
        // malformed chunk, skip
      }
    }
  }
}
