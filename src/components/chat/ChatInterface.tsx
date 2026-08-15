"use client";

import { useEffect, useRef, useState } from "react";
import { useStore, newId } from "@/lib/store";
import { SparklesIcon, SendIcon, StopIcon, RefreshIcon, MicIcon, ImageIcon, FileIcon, ThumbsUpIcon, ThumbsDownIcon, CopyIcon, CheckIcon, BrainIcon, GlobeIcon, TargetIcon } from "../ui/icons";
import { NexoraLogo } from "../ui/icons";
import { cn } from "@/utils/cn";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string[];
  streaming?: boolean;
  ts: number;
}

type AIMode = "fast" | "balanced" | "deep";

export function ChatInterface() {
  const { active, activeId, newChat, addMessage, patchMessage } = useStore();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<AIMode>("balanced");
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef(false);

  const messages: Message[] = (active?.messages as Message[]) ?? [];

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || streaming) return;

    const text = input.trim();
    setInput("");
    cancelRef.current = false;

    let convId = activeId;
    if (!convId) {
      convId = newChat();
    }

    // Add user message
    const userMsgId = newId();
    addMessage(convId, {
      id: userMsgId,
      role: "user",
      content: text,
      ts: Date.now(),
    });

    // Add assistant placeholder
    const assistantId = newId();
    addMessage(convId, {
      id: assistantId,
      role: "assistant",
      content: "",
      thinking: [],
      ts: Date.now(),
      streaming: true,
    });

    setStreaming(true);
    setThinking(["🎯 Analyzing your question..."]);

    try {
      // Build message history
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Show thinking stages
      setTimeout(() => setThinking((t) => [...t, "🤖 Selecting optimal AI agents..."]), 500);
      setTimeout(() => setThinking((t) => [...t, "🔄 Running agents in parallel..."]), 1000);

      // Call master API
      const res = await fetch("/api/chat/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, { role: "user", content: text }],
          mode,
        }),
      });

      if (!res.ok) throw new Error("Request failed");

      // Get pipeline info
      const agents = res.headers.get("x-agents-used") || "Nexora AI";
      const orchestrator = res.headers.get("x-orchestrator") || "";

      // Stream response
      const reader = res.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let fullText = "";
        setThinking([]);

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelRef.current) break;
          fullText += decoder.decode(value, { stream: true });
          patchMessage(convId!, assistantId, { content: fullText });
        }

        patchMessage(convId!, assistantId, {
          content: fullText || "I couldn't generate a response. Please try again.",
          streaming: false,
        });
      }
    } catch (error) {
      patchMessage(convId!, assistantId, {
        content: "⚠️ Sorry, something went wrong. Please try again.",
        streaming: false,
      });
    }

    setStreaming(false);
    setThinking([]);
  };

  const handleStop = () => {
    cancelRef.current = true;
    setStreaming(false);
    setThinking([]);
  };

  // Empty state
  if (!activeId || messages.length === 0) {
    return (
      <div className="flex h-full flex-col">
        {/* Welcome Screen */}
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="max-w-2xl text-center">
            {/* Logo */}
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <NexoraLogo size={64} />
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface border-2 border-accent">
                  <SparklesIcon size={12} className="text-accent" />
                </div>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-text mb-2">
              What can I help you with?
            </h1>
            <p className="text-text-secondary mb-8">
              I'm powered by multiple AI agents working in consensus. Ask me anything.
            </p>

            {/* Suggestions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {[
                { icon: BrainIcon, text: "Explain quantum computing in simple terms", color: "text-accent" },
                { icon: GlobeIcon, text: "Research the latest AI developments", color: "text-success" },
                { icon: TargetIcon, text: "Help me write a Python script", color: "text-warning" },
                { icon: SparklesIcon, text: "Create a landing page for my startup", color: "text-nebula" },
              ].map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput(s.text)}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition hover:border-accent hover:bg-subtle"
                >
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg bg-subtle transition group-hover:bg-accent-soft", s.color)}>
                    <s.icon size={20} />
                  </div>
                  <span className="text-sm text-text-secondary group-hover:text-text transition">
                    {s.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Input Area */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={handleStop}
          streaming={streaming}
          inputRef={inputRef}
          mode={mode}
          onModeChange={setMode}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              thinking={msg.streaming ? thinking : []}
            />
          ))}
        </div>
      </div>

      {/* Input Area */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={handleStop}
        streaming={streaming}
        inputRef={inputRef}
        mode={mode}
        onModeChange={setMode}
      />
    </div>
  );
}

// ═══════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════
function MessageBubble({ message, thinking }: { message: Message; thinking: string[] }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="message-user max-w-[80%] px-4 py-3">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-nebula">
          <NexoraLogo size={18} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Thinking indicator */}
        {thinking.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {thinking.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-text-muted animate-fade-in"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                {t}
              </div>
            ))}
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <div className="message-ai px-4 py-3">
            <div className="prose text-sm">
              {message.streaming && !message.content ? (
                <div className="typing-dots">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-text-muted mx-0.5">.</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-text-muted mx-0.5">.</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-text-muted mx-0.5">.</span>
                </div>
              ) : (
                <MessageContent content={message.content} />
              )}
              {message.streaming && message.content && (
                <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-0.5" />
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {!message.streaming && message.content && (
          <div className="mt-2 flex items-center gap-1">
            <button
              onClick={copyToClipboard}
              className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-text-muted hover:bg-subtle hover:text-text transition"
            >
              {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-subtle hover:text-success transition">
              <ThumbsUpIcon size={14} />
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-subtle hover:text-danger transition">
              <ThumbsDownIcon size={14} />
            </button>
            <button className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-text-muted hover:bg-subtle hover:text-text transition">
              <RefreshIcon size={14} />
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MESSAGE CONTENT (with markdown rendering)
// ═══════════════════════════════════════════
function MessageContent({ content }: { content: string }) {
  // Simple markdown-like rendering
  const lines = content.split("\n");

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        // Code block
        if (line.startsWith("```")) {
          return null; // Handle code blocks separately in future
        }

        // Headers
        if (line.startsWith("### ")) {
          return <h4 key={i} className="font-semibold text-text mt-4 mb-2">{line.slice(4)}</h4>;
        }
        if (line.startsWith("## ")) {
          return <h3 key={i} className="font-semibold text-text text-lg mt-4 mb-2">{line.slice(3)}</h3>;
        }
        if (line.startsWith("# ")) {
          return <h2 key={i} className="font-bold text-text text-xl mt-4 mb-2">{line.slice(2)}</h2>;
        }

        // List items
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-accent">•</span>
              <span>{renderInlineMarkdown(line.slice(2))}</span>
            </div>
          );
        }

        // Numbered list
        const numberedMatch = line.match(/^(\d+)\.\s/);
        if (numberedMatch) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-accent min-w-[1.5rem]">{numberedMatch[1]}.</span>
              <span>{renderInlineMarkdown(line.slice(numberedMatch[0].length))}</span>
            </div>
          );
        }

        // Empty line
        if (!line.trim()) {
          return <div key={i} className="h-2" />;
        }

        // Regular paragraph
        return <p key={i}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

function renderInlineMarkdown(text: string): React.ReactNode {
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Inline code
  text = text.replace(/`(.+?)`/g, '<code class="bg-subtle px-1.5 py-0.5 rounded text-accent text-xs">$1</code>');

  return <span dangerouslySetInnerHTML={{ __html: text }} />;
}

// ═══════════════════════════════════════════
// CHAT INPUT
// ═══════════════════════════════════════════
interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  mode: AIMode;
  onModeChange: (m: AIMode) => void;
}

function ChatInput({ value, onChange, onSend, onStop, streaming, inputRef, mode, onModeChange }: ChatInputProps) {
  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      <div className="mx-auto max-w-3xl">
        {/* Input box */}
        <div className="relative rounded-2xl border border-border bg-elevated focus-within:border-accent transition">
          {/* Mode pills (mobile) */}
          <div className="flex items-center gap-1 px-3 pt-2 md:hidden">
            {(["fast", "balanced", "deep"] as AIMode[]).map((m) => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition",
                  mode === m
                    ? "bg-accent text-void"
                    : "bg-subtle text-text-secondary hover:text-text"
                )}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2 p-3">
            {/* Attach button */}
            <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-subtle hover:text-text transition">
              <ImageIcon size={20} />
            </button>

            {/* Text input */}
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Ask anything..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
              disabled={streaming}
            />

            {/* Send/Stop button */}
            {streaming ? (
              <button
                onClick={onStop}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger text-white hover:bg-danger/80 transition"
              >
                <StopIcon size={18} />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!value.trim()}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition",
                  value.trim()
                    ? "bg-accent text-void hover:bg-accent-hover"
                    : "bg-subtle text-text-muted"
                )}
              >
                <SendIcon size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2 flex items-center justify-between text-xs text-text-dim">
          <span>
            Press <kbd className="rounded bg-subtle px-1.5 py-0.5 font-mono">Enter</kbd> to send
          </span>
          <span>Nexora can make mistakes. Verify important info.</span>
        </div>
      </div>
    </div>
  );
}
