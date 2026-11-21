import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Headphones,
  MessageSquare,
  RotateCcw,
  Send,
  UserCheck,
  X,
} from 'lucide-react';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import {type AuthUser, useAuth} from '../context/AuthContext';
import {useRegion} from '../context/RegionContext';
import {useSupport} from '../context/SupportContext';
import {getOfficialWhatsAppUrl, VERTYLEX_EMAIL} from '../data/vertylex';
import {apiFetch} from '../lib/apiClient';

interface SuggestedAction {
  label: string;
  path: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  suggestedActions?: SuggestedAction[];
}

const CONVERSATION_STARTERS = [
  'I want to start a business.',
  'I need an advertisement.',
  'I want a professional flyer.',
  'I need a website for my business.',
  'I want to develop an application.',
  "I'm not sure what service I need.",
];

function getWelcomeText(user: AuthUser | null): string {
  const firstName = user?.name?.trim().split(/\s+/)[0] || '';
  if (firstName) {
    return `Hello, ${firstName}! 👋 Welcome to VERTYLEX. It's great to have you here. How can I help you today?`;
  }
  return "Hello! 👋 Welcome to VERTYLEX. I'm your virtual assistant. Are you looking to create something, grow your business or explore our services? I'm here to help.";
}

export function VertylexAssistant() {
  const {user} = useAuth();
  const {region} = useRegion();
  const {integrations, assistantOpen, prefilledTopic, openAssistant, closeAssistant} = useSupport();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'model',
      text: getWelcomeText(user),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  const [showEscalate, setShowEscalate] = useState(false);
  const [escName, setEscName] = useState('');
  const [escEmail, setEscEmail] = useState('');
  const [escMessage, setEscMessage] = useState('');
  const [escError, setEscError] = useState('');
  const [escSending, setEscSending] = useState(false);
  const [escTicketRef, setEscTicketRef] = useState<string | null>(null);

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync welcome greeting whenever authentication state resolves or changes
  useEffect(() => {
    const welcomeText = getWelcomeText(user);
    setMessages((prev) =>
      prev.map((msg) => (msg.id === 'welcome' ? {...msg, text: welcomeText} : msg)),
    );
    if (user) {
      setEscName((prev) => prev || user.name);
      setEscEmail((prev) => prev || user.email);
    }
  }, [user]);

  useEffect(() => {
    if (assistantOpen && prefilledTopic) {
      setInput(prefilledTopic);
      setShowEscalate(false);
    }
  }, [assistantOpen, prefilledTopic]);

  useEffect(() => {
    if (assistantOpen && !showEscalate) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [assistantOpen, showEscalate]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages, sending, showEscalate, escTicketRef]);

  function handleResetConversation() {
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        text: getWelcomeText(user),
      },
    ]);
    setChatError('');
    setLastFailedPrompt(null);
    setShowEscalate(false);
  }

  function handleNavigateAction(path: string) {
    navigate(path);
    if (path.includes('#')) {
      const hashId = path.split('#')[1];
      setTimeout(() => {
        document.getElementById(hashId)?.scrollIntoView({behavior: 'smooth'});
      }, 150);
    }
    if (window.innerWidth < 640) {
      closeAssistant();
    }
  }

  async function sendPrompt(textToSend: string, options?: {isRetry?: boolean}) {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    setChatError('');
    setLastFailedPrompt(null);

    let conversationForApi = messages;
    if (!options?.isRetry) {
      const userMsg: ChatMessage = {
        id: `${Date.now()}-user`,
        role: 'user',
        text: trimmed,
      };
      conversationForApi = [...messages, userMsg];
      setMessages(conversationForApi);
      setInput('');
    }

    setSending(true);

    try {
      const res = await apiFetch('/api/assistant/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          messages: conversationForApi
            .filter((m) => m.id !== 'welcome')
            .map((m) => ({role: m.role, text: m.text})),
          regionName: user?.countryName || region.country,
          currencyCode: user?.preferredCurrency || region.currency,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        suggestedActions?: SuggestedAction[];
        error?: string;
      };
      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'VERTYLEX Assistant is currently unavailable.');
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-model`,
          role: 'model',
          text: data.reply || '',
          suggestedActions: Array.isArray(data.suggestedActions)
            ? data.suggestedActions
            : undefined,
        },
      ]);
    } catch (err) {
      setLastFailedPrompt(trimmed);
      setChatError(
        err instanceof Error
          ? err.message
          : 'Unable to reach VERTYLEX Assistant right now.',
      );
    } finally {
      setSending(false);
    }
  }

  async function handleEscalateSubmit(e: FormEvent) {
    e.preventDefault();
    setEscError('');
    if (escName.trim().length < 2) {
      setEscError('Please enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(escEmail.trim())) {
      setEscError('Please enter a valid email address.');
      return;
    }
    if (escMessage.trim().length < 10) {
      setEscError('Please briefly describe what you need help with.');
      return;
    }

    setEscSending(true);
    try {
      const summary = messages
        .slice(-8)
        .map((m) => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.text}`)
        .join('\n');

      const res = await apiFetch('/api/support/escalate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: escName.trim(),
          email: escEmail.trim(),
          topic: 'VERTYLEX Assistant Human Handover',
          message: escMessage.trim(),
          conversationSummary: summary,
        }),
      });
      const data = (await res.json()) as {
        ticket?: {referenceId: string};
        error?: string;
      };
      if (!res.ok || !data.ticket) {
        throw new Error(data.error || 'Unable to escalate your enquiry.');
      }
      setEscTicketRef(data.ticket.referenceId);
      setEscMessage('');
    } catch (err) {
      setEscError(err instanceof Error ? err.message : 'Escalation failed.');
    } finally {
      setEscSending(false);
    }
  }

  const officialWaUrl = integrations.whatsapp.configured
    ? getOfficialWhatsAppUrl(integrations.whatsapp.officialUrl)
    : null;

  return (
    <>
      {!assistantOpen && (
        <button
          type="button"
          onClick={() => openAssistant()}
          aria-label="Open VERTYLEX Assistant"
          className="vtx-pop-in fixed right-4 bottom-4 z-40 inline-flex h-10 items-center gap-2 rounded-md border border-[#141416] bg-[#141416] px-4 text-xs font-medium text-white shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] sm:right-6 sm:bottom-6"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          <span className="whitespace-nowrap">VERTYLEX Assistant</span>
        </button>
      )}

      {assistantOpen && (
        <section
          aria-label="VERTYLEX Customer Support Assistant"
          className="vtx-drawer-enter fixed right-3 bottom-3 z-50 flex h-[min(580px,84vh)] w-[calc(100vw-1.5rem)] max-w-md flex-col overflow-hidden rounded-lg border border-[#E4E4E7] bg-white shadow-xl sm:right-6 sm:bottom-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E4E4E7] bg-[#141416] px-4 py-3 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <Headphones className="h-4 w-4 shrink-0 text-white" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="truncate font-display text-sm font-semibold leading-none text-white">
                  VERTYLEX Assistant
                </h2>
                <p className="mt-1 truncate text-[11px] text-[#D4D4D8]">
                  Customer Support{user ? ` · ${user.name.split(/\s+/)[0]}` : ''} ·{' '}
                  {user?.preferredCurrency || region.currency}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {messages.length > 1 && !showEscalate && (
                <button
                  type="button"
                  onClick={handleResetConversation}
                  title="Start a new conversation"
                  aria-label="Start a new conversation"
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-[#D4D4D8] hover:bg-white/10 hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowEscalate((prev) => !prev);
                  setEscTicketRef(null);
                  setEscError('');
                }}
                className="rounded border border-white/20 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/10 whitespace-nowrap"
              >
                {showEscalate ? 'Back to Chat' : 'Human Support'}
              </button>
              <button
                type="button"
                onClick={closeAssistant}
                aria-label="Close VERTYLEX Assistant"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-[#D4D4D8] hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          {showEscalate ? (
            <div className="vtx-panel-enter flex-1 overflow-y-auto p-4">
              {escTicketRef ? (
                <div className="rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-5">
                  <div className="flex items-center gap-2 text-[#1D4ED8]">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span className="font-mono text-xs font-medium">{escTicketRef}</span>
                  </div>
                  <h3 className="mt-2 font-display text-base font-semibold text-[#141416]">
                    Escalated to Human Support
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#5A5A62]">
                    Our human support team has received your enquiry and will respond to{' '}
                    <span className="font-medium text-[#141416]">{escEmail}</span>. You may also
                    reference <span className="font-mono">{escTicketRef}</span> when emailing{' '}
                    {VERTYLEX_EMAIL}.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEscalate(false);
                      setEscTicketRef(null);
                    }}
                    className="mt-4 inline-flex h-9 items-center rounded-md bg-[#141416] px-3.5 text-xs font-medium text-white hover:bg-[#1D4ED8]"
                  >
                    Return to Assistant
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEscalateSubmit} noValidate className="space-y-3.5">
                  <div className="flex items-start gap-2.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-3">
                    <UserCheck
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]"
                      aria-hidden="true"
                    />
                    <p className="text-xs leading-relaxed text-[#5A5A62]">
                      Need human assistance with a complex requirement or quotation? Send your
                      enquiry directly to our support specialists.
                    </p>
                  </div>

                  {escError && (
                    <div
                      role="alert"
                      className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                    >
                      {escError}
                    </div>
                  )}

                  <div>
                    <label htmlFor="esc-name" className="block text-xs font-medium text-[#141416]">
                      Your name
                    </label>
                    <input
                      id="esc-name"
                      type="text"
                      value={escName}
                      onChange={(e) => setEscName(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-xs text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="esc-email"
                      className="block text-xs font-medium text-[#141416]"
                    >
                      Email address
                    </label>
                    <input
                      id="esc-email"
                      type="email"
                      value={escEmail}
                      onChange={(e) => setEscEmail(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-[#D4D4D8] px-3 text-xs text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="esc-message"
                      className="block text-xs font-medium text-[#141416]"
                    >
                      How can our human team help?
                    </label>
                    <textarea
                      id="esc-message"
                      rows={4}
                      value={escMessage}
                      onChange={(e) => setEscMessage(e.target.value)}
                      placeholder="Describe your question or project details..."
                      className="mt-1 w-full rounded-md border border-[#D4D4D8] p-2.5 text-xs text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={escSending}
                    className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[#141416] px-4 text-xs font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-60"
                  >
                    {escSending ? 'Sending to Human Support...' : 'Send to Human Support'}
                  </button>
                </form>
              )}

              {/* Official WhatsApp Business API Channel Status */}
              <div className="mt-5 border-t border-[#E4E4E7] pt-4">
                <p className="text-xs font-semibold text-[#141416]">
                  Official WhatsApp Business Channel
                </p>
                {officialWaUrl ? (
                  <a
                    href={officialWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-3 text-xs font-medium text-[#141416] hover:border-[#141416]"
                  >
                    Continue on Official WhatsApp Business
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#5A5A62]">
                    Official WhatsApp Business support activates once the business messaging channel
                    is connected. In the meantime, human escalations here and emails to{' '}
                    <span className="font-medium text-[#141416]">{VERTYLEX_EMAIL}</span> reach our
                    team directly.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto bg-[#FAFAFA] p-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`vtx-panel-enter flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-[#141416] text-white'
                          : 'border border-[#E4E4E7] bg-white text-[#141416]'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {msg.role === 'model' &&
                      msg.suggestedActions &&
                      msg.suggestedActions.length > 0 && (
                        <div className="mt-2 flex max-w-[88%] flex-wrap gap-1.5">
                          {msg.suggestedActions.map((action) => (
                            <button
                              key={`${msg.id}-${action.path}`}
                              type="button"
                              onClick={() => handleNavigateAction(action.path)}
                              className="inline-flex items-center gap-1 rounded-md border border-[#D4D4D8] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#141416] transition-colors hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
                            >
                              <span>{action.label}</span>
                              <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                ))}

                {messages.length === 1 && !sending && (
                  <div className="space-y-2 pt-1">
                    <p className="text-[11px] font-medium text-[#5A5A62]">
                      How can we help you today?
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {CONVERSATION_STARTERS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => void sendPrompt(q)}
                          className="rounded-md border border-[#E4E4E7] bg-white px-3 py-2 text-left text-xs text-[#141416] transition-colors hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sending && (
                  <div className="vtx-panel-enter flex justify-start" aria-live="polite">
                    <div className="inline-flex items-center gap-2 rounded-lg border border-[#E4E4E7] bg-white px-3.5 py-2.5 text-xs text-[#5A5A62]">
                      <span>VERTYLEX Assistant is typing</span>
                      <span className="inline-flex items-center gap-1" aria-hidden="true">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1D4ED8] [animation-delay:-0.2s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1D4ED8] [animation-delay:-0.1s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1D4ED8]" />
                      </span>
                    </div>
                  </div>
                )}

                {chatError && (
                  <div
                    role="alert"
                    className="vtx-panel-enter rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800"
                  >
                    <p>{chatError}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {lastFailedPrompt && (
                        <button
                          type="button"
                          onClick={() => void sendPrompt(lastFailedPrompt, {isRetry: true})}
                          className="font-semibold underline hover:text-red-950"
                        >
                          Try Again
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowEscalate(true)}
                        className="font-medium underline hover:text-red-950"
                      >
                        Escalate to Human Support
                      </button>
                    </div>
                  </div>
                )}
                <div ref={listEndRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendPrompt(input);
                }}
                className="flex items-center gap-2 border-t border-[#E4E4E7] bg-white p-3"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about services, flyers, websites, or projects..."
                  aria-label="Message VERTYLEX Assistant"
                  className="h-10 flex-1 rounded-md border border-[#D4D4D8] px-3 text-xs text-[#141416] placeholder:text-[#A1A1AA] focus:border-[#1D4ED8] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  aria-label="Send message"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[#141416] text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </section>
      )}
    </>
  );
}
