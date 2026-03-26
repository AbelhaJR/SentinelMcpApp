import { useMsal } from "@azure/msal-react";
import { apiScopes } from "./authConfig";
import { useState, useRef, useEffect } from "react";

const FOUNDRY_ENDPOINT = import.meta.env.VITE_FOUNDRY_URL as string;
const AGENT_ID         = import.meta.env.VITE_AGENT_ID as string;

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  ts: string;
}

function timestamp() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

export default function Chat() {
  const { instance, accounts } = useMsal();
  const [messages, setMessages]   = useState<Message[]>([
    { role: "system", content: "Session established. Sentinel MCP Agent ready.", ts: timestamp() },
  ]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [threadId, setThreadId]   = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const user                      = accounts[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function getToken(): Promise<string> {
    const result = await instance.acquireTokenSilent({
      scopes: apiScopes,
      account: user,
    });
    return result.accessToken;
  }

  async function send() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setError(null);
    setMessages(m => [...m, { role: "user", content: text, ts: timestamp() }]);
    setLoading(true);

    try {
      const token = await getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // ── Create thread on first message ─────────────────────────────────
      let tid = threadId;
      if (!tid) {
        const res = await fetch(`${FOUNDRY_ENDPOINT}/threads`, {
          method: "POST", headers, body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`Failed to create thread: ${res.status}`);
        tid = (await res.json()).id;
        setThreadId(tid);
      }

      // ── Post user message ───────────────────────────────────────────────
      await fetch(`${FOUNDRY_ENDPOINT}/threads/${tid}/messages`, {
        method: "POST", headers,
        body: JSON.stringify({ role: "user", content: text }),
      });

      // ── Start a run ─────────────────────────────────────────────────────
      const runRes = await fetch(`${FOUNDRY_ENDPOINT}/threads/${tid}/runs`, {
        method: "POST", headers,
        body: JSON.stringify({ assistant_id: AGENT_ID }),
      });
      if (!runRes.ok) throw new Error(`Failed to start run: ${runRes.status}`);
      const run = await runRes.json();

      // ── Poll until done ─────────────────────────────────────────────────
      let status = run.status;
      let attempts = 0;
      while (!["completed", "failed", "cancelled"].includes(status) && attempts < 60) {
        await new Promise(r => setTimeout(r, 1500));
        const poll = await fetch(`${FOUNDRY_ENDPOINT}/threads/${tid}/runs/${run.id}`, { headers });
        status = (await poll.json()).status;
        attempts++;
      }

      if (status !== "completed") throw new Error(`Run ended with status: ${status}`);

      // ── Fetch latest messages ───────────────────────────────────────────
      const msgsRes = await fetch(`${FOUNDRY_ENDPOINT}/threads/${tid}/messages`, { headers });
      const list = (await msgsRes.json()).data as any[];
      const reply = list[0]?.content?.[0]?.text?.value ?? "(no response)";

      setMessages(m => [...m, { role: "assistant", content: reply, ts: timestamp() }]);
    } catch (err: any) {
      setError(err.message);
      setMessages(m => [...m, {
        role: "system",
        content: `Error: ${err.message}`,
        ts: timestamp(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  const styles: Record<string, React.CSSProperties> = {
    root: {
      minHeight: "100vh",
      background: "#0a0e1a",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      color: "#c9d8ee",
    },
    header: {
      borderBottom: "1px solid #1e3a5f",
      padding: "12px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#0d1526",
    },
    headerTitle: {
      fontSize: 11,
      letterSpacing: 3,
      color: "#4a9eff",
    },
    headerUser: {
      fontSize: 11,
      color: "#4a6080",
    },
    messages: {
      flex: 1,
      overflowY: "auto",
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
    },
    bubble: (role: string): React.CSSProperties => ({
      maxWidth: "80%",
      alignSelf: role === "user" ? "flex-end" : "flex-start",
      background:
        role === "user"    ? "#0f2a4a" :
        role === "system"  ? "transparent" : "#0d1a2e",
      border: role === "system" ? "none" : "1px solid",
      borderColor:
        role === "user"   ? "#1e4a7a" : "#1e3a5f",
      padding: role === "system" ? "0" : "12px 16px",
      fontSize: 13,
      lineHeight: 1.7,
      color:
        role === "system" ? "#2a4a6a" : "#c9d8ee",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    }),
    ts: {
      fontSize: 10,
      color: "#2a4a6a",
      marginTop: 6,
    },
    inputRow: {
      borderTop: "1px solid #1e3a5f",
      padding: "16px 24px",
      display: "flex",
      gap: 12,
      background: "#0d1526",
    },
    input: {
      flex: 1,
      background: "#0a0e1a",
      border: "1px solid #1e3a5f",
      color: "#c9d8ee",
      padding: "10px 14px",
      fontSize: 13,
      fontFamily: "inherit",
      outline: "none",
    },
    sendBtn: {
      background: loading ? "#0f2a4a" : "#1a56db",
      color: loading ? "#4a6080" : "#fff",
      border: "none",
      padding: "10px 24px",
      fontSize: 11,
      letterSpacing: 2,
      cursor: loading ? "not-allowed" : "pointer",
      fontFamily: "inherit",
    },
  };

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}>SENTINEL MCP AGENT</div>
          {threadId && (
            <div style={{ fontSize: 10, color: "#2a4a6a", marginTop: 2 }}>
              thread: {threadId}
            </div>
          )}
        </div>
        <div style={styles.headerUser}>
          {user?.username ?? user?.name}
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "80%" }}>
            <div style={styles.bubble(m.role)}>{m.content}</div>
            {m.role !== "system" && <div style={styles.ts}>{m.ts}</div>}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start" }}>
            <div style={styles.bubble("assistant")}>
              <span style={{ opacity: 0.5 }}>Agent is thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Enter a query or incident ID..."
          disabled={loading}
        />
        <button style={styles.sendBtn} onClick={send} disabled={loading}>
          {loading ? "RUNNING" : "SEND"}
        </button>
      </div>
    </div>
  );
}
