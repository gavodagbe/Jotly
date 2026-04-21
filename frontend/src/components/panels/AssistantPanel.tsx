"use client";

import { type FormEvent, type RefObject } from "react";
import { RichTextContent } from "@/components/ui/RichTextEditor";
import { ChatIcon, CloseIcon, SendIcon } from "@/components/ui/icons";

type UserLocale = "en" | "fr";
type AssistantSource = "openai" | "heuristic";

type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  source?: AssistantSource;
  usedTaskCount?: number;
  usedCommentCount?: number;
  warning?: string | null;
};

export type AssistantPanelProps = {
  isOpen: boolean;
  locale: UserLocale;
  activeTimeZone: string | null;
  messages: AssistantChatMessage[];
  isLoading: boolean;
  question: string;
  errorMessage: string | null;
  promptSuggestions: ReadonlyArray<string>;
  maxQuestionLength: number;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onQuestionChange: (value: string) => void;
  onPromptSelect: (prompt: string) => void;
  formatAssistantSourceLabel: (source: AssistantSource | undefined, locale: UserLocale) => string;
  formatDateTime: (value: string, locale: UserLocale, timeZone: string | null) => string;
};

export function AssistantPanel({
  isOpen,
  locale,
  activeTimeZone,
  messages,
  isLoading,
  question,
  errorMessage,
  promptSuggestions,
  maxQuestionLength,
  messagesEndRef,
  onClose,
  onSubmit,
  onQuestionChange,
  onPromptSelect,
  formatAssistantSourceLabel,
  formatDateTime,
}: AssistantPanelProps) {
  if (!isOpen) return null;

  const isFrench = locale === "fr";

  return (
    <section className="animate-scale-in fixed bottom-24 left-4 right-4 z-40 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:left-auto sm:right-6 sm:w-[580px]">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent">
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2l1.5 3h3l-2.5 2.5.8 3L8 9l-2.8 1.5.8-3L3.5 5h3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isFrench ? "Assistant IA" : "AI Assistant"}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
          onClick={onClose}
          disabled={isLoading}
          aria-label={isFrench ? "Fermer l'assistant IA" : "Close AI assistant"}
        >
          <CloseIcon />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted">
            {isFrench
              ? "Posez vos questions sur vos taches, vos commentaires et vos priorites."
              : "Ask about your tasks, comments, and priorities."}
          </p>
        ) : (
          <>
            {messages.map((message) => {
              const isUserMessage = message.role === "user";
              const hasAssistantMetadata =
                !isUserMessage &&
                (Boolean(message.source) ||
                  typeof message.usedTaskCount === "number" ||
                  typeof message.usedCommentCount === "number");

              return (
                <article
                  key={message.id}
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                    isUserMessage
                      ? "ml-auto rounded-br-md bg-accent text-white"
                      : "rounded-bl-md bg-surface-soft text-foreground"
                  }`}
                >
                  {isUserMessage ? (
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  ) : (
                    <div className="space-y-2">
                      <RichTextContent
                        value={message.content}
                        className="text-sm leading-6 [&_p]:m-0 [&_p+p]:mt-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_h1]:mb-2 [&_h1]:mt-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-1 [&_h3]:text-sm [&_h3]:font-medium [&_code]:rounded [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.92em] [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2"
                      />

                      {message.warning ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                          {message.warning}
                        </div>
                      ) : null}

                      {hasAssistantMetadata ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                          {message.source ? (
                            <span className="rounded-full border border-line bg-surface px-2 py-0.5 font-medium text-foreground">
                              {formatAssistantSourceLabel(message.source, locale)}
                            </span>
                          ) : null}
                          {typeof message.usedTaskCount === "number" ? (
                            <span className="rounded-full border border-line bg-surface px-2 py-0.5">
                              {isFrench ? `${message.usedTaskCount} taches` : `${message.usedTaskCount} tasks`}
                            </span>
                          ) : null}
                          {typeof message.usedCommentCount === "number" ? (
                            <span className="rounded-full border border-line bg-surface px-2 py-0.5">
                              {isFrench ? `${message.usedCommentCount} commentaires` : `${message.usedCommentCount} comments`}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}

                  <p className={`mt-2 text-[10px] ${isUserMessage ? "text-white/60" : "text-muted"}`}>
                    {formatDateTime(message.timestamp, locale, activeTimeZone)}
                  </p>
                </article>
              );
            })}
            {isLoading ? (
              <article className="max-w-[88%] rounded-2xl rounded-bl-md bg-surface-soft px-3.5 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent/60" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent/60" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent/60" style={{ animationDelay: "300ms" }} />
                </div>
              </article>
            ) : null}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="border-t border-line px-4 py-3">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {promptSuggestions.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-surface-soft px-2.5 py-1 text-[11px] text-muted transition-colors hover:bg-accent-soft hover:text-accent"
              onClick={() => onPromptSelect(prompt)}
              disabled={isLoading}
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 1l1 2.5h2.5l-2 1.5.8 2.5L6 6l-2.3 1.5.8-2.5-2-1.5H5z" />
              </svg>
              {prompt.length > 40 ? prompt.slice(0, 40) + "..." : prompt}
            </button>
          ))}
        </div>

        <form className="flex items-center gap-2" onSubmit={onSubmit}>
          <input
            type="text"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface-soft px-3 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/15"
            maxLength={maxQuestionLength}
            placeholder={isFrench ? "Posez une question..." : "Ask a question..."}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-all hover:bg-accent-strong disabled:opacity-50"
            disabled={isLoading}
          >
            <SendIcon />
          </button>
        </form>

        {errorMessage ? (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export type AssistantFabProps = {
  isOpen: boolean;
  locale: UserLocale;
  onToggle: () => void;
};

export function AssistantFab({ isOpen, locale, onToggle }: AssistantFabProps) {
  const isFrench = locale === "fr";

  return (
    <button
      type="button"
      className="animate-pulse-soft fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      onClick={onToggle}
      aria-label={
        isOpen
          ? isFrench
            ? "Fermer l'assistant IA"
            : "Close AI assistant"
          : isFrench
            ? "Ouvrir l'assistant IA"
            : "Open AI assistant"
      }
    >
      <ChatIcon />
    </button>
  );
}
