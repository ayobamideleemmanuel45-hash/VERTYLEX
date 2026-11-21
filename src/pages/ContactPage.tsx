import {ArrowUpRight, CheckCircle2, Headphones, Loader2, Lock, Mail} from 'lucide-react';
import {useEffect, useState, type FormEvent} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useSupport} from '../context/SupportContext';
import {getMailtoUrl, getOfficialWhatsAppUrl, VERTYLEX_EMAIL} from '../data/vertylex';
import {apiFetch} from '../lib/apiClient';

export function ContactPage() {
  const {user, loading, refreshUser} = useAuth();
  const {integrations, openAssistant} = useSupport();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    referenceId: string;
    emailDelivered: boolean;
  } | null>(null);

  useEffect(() => {
    try {
      const rawDraft = sessionStorage.getItem('vertylex_contact_draft');
      if (rawDraft) {
        const draft = JSON.parse(rawDraft) as {subject?: string; message?: string};
        if (draft.subject) setSubject(draft.subject);
        if (draft.message) setMessage(draft.message);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (user) {
      setName((prev) => prev || user.name);
      setEmail((prev) => prev || user.email);
    }
  }, [user]);

  const officialWaUrl = integrations.whatsapp.configured
    ? getOfficialWhatsAppUrl(integrations.whatsapp.officialUrl)
    : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError('');

    const nextErrors: Record<string, string> = {};
    if (name.trim().length < 2) nextErrors.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Please enter a valid email address.';
    }
    if (subject.trim().length < 2) nextErrors.subject = 'Please enter a subject.';
    if (message.trim().length < 10) {
      nextErrors.message = 'Please enter a message of at least 10 characters.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/contact', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const data = (await res.json()) as {
        contact?: {referenceId: string};
        emailDelivered?: boolean;
        error?: string;
      };
      if (res.status === 401) {
        try {
          sessionStorage.setItem(
            'vertylex_contact_draft',
            JSON.stringify({subject: subject.trim(), message: message.trim()}),
          );
        } catch {
          // Ignore storage errors
        }
        await refreshUser();
        navigate('/login?redirect=%2Fcontact&reason=project');
        return;
      }
      if (!res.ok || !data.contact) {
        throw new Error(data.error || 'Unable to send your message right now.');
      }
      try {
        sessionStorage.removeItem('vertylex_contact_draft');
      } catch {
        // Ignore storage errors
      }
      setConfirmation({
        referenceId: data.contact.referenceId,
        emailDelivered: Boolean(data.emailDelivered),
      });
      setSubject('');
      setMessage('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[#FAFAFA]">
      <section className="border-b border-[#E4E4E7] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-[#1D4ED8]">Contact &amp; Support</p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-[#141416] sm:text-5xl [text-wrap:balance]">
              Speak directly with VERTYLEX.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-[#5A5A62] sm:text-lg">
              Get immediate answers from VERTYLEX Assistant, email our official inbox, or sign in
              to submit an enquiry through the VERTYLEX system. For full project scoping, visit
              our{' '}
              <Link to="/submit-project" className="font-medium text-[#1D4ED8] hover:underline">
                Project Submission
              </Link>{' '}
              page.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            {/* Official Support Channels */}
            <div className="space-y-6 lg:col-span-5">
              <div className="rounded-lg border border-[#E4E4E7] bg-white p-7">
                <div className="flex items-center gap-3">
                  <Headphones className="h-5 w-5 text-[#1D4ED8]" aria-hidden="true" />
                  <h2 className="font-display text-lg font-semibold text-[#141416]">
                    VERTYLEX Assistant &amp; WhatsApp Business
                  </h2>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#5A5A62]">
                  Chat with VERTYLEX Assistant for instant guidance on services, pricing, and
                  submissions—or escalate directly to human support.
                </p>

                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    onClick={() => openAssistant()}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#141416] px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8]"
                  >
                    Open VERTYLEX Assistant
                  </button>

                  {officialWaUrl ? (
                    <a
                      href={officialWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-4 text-sm font-medium text-[#141416] hover:border-[#141416]"
                    >
                      Continue via Official WhatsApp Business
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  ) : (
                    <p className="rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-3.5 py-2.5 text-xs leading-relaxed text-[#5A5A62]">
                      Official WhatsApp Business support activates once the business messaging
                      channel is connected.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[#E4E4E7] bg-white p-7">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-[#1D4ED8]" aria-hidden="true" />
                  <h2 className="font-display text-lg font-semibold text-[#141416]">
                    Official Business Email
                  </h2>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#5A5A62]">
                  Send business proposals, supporting files, or direct enquiries to our official
                  inbox.
                </p>
                <p className="mt-4 text-sm font-medium text-[#141416]">{VERTYLEX_EMAIL}</p>
                <a
                  href={getMailtoUrl('Enquiry for VERTYLEX')}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-4 text-sm font-medium text-[#141416] transition-colors duration-150 hover:border-[#141416]"
                >
                  Email {VERTYLEX_EMAIL}
                </a>
              </div>
            </div>

            {/* Contact Form (Authenticated Only) */}
            <div className="lg:col-span-7">
              <div className="rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-10">
                <h2 className="font-display text-2xl font-bold text-[#141416]">
                  Send a Project or General Enquiry
                </h2>
                <p className="mt-2 text-sm text-[#5A5A62]">
                  Send a message directly through the VERTYLEX system.
                </p>

                {loading ? (
                  <div className="mt-8 text-sm text-[#5A5A62]">Checking your session...</div>
                ) : !user ? (
                  <div className="mt-8 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-7">
                    <div className="flex items-start gap-3">
                      <Lock
                        className="mt-0.5 h-5 w-5 shrink-0 text-[#1D4ED8]"
                        aria-hidden="true"
                      />
                      <div>
                        <h3 className="font-display text-base font-semibold text-[#141416]">
                          Account required for enquiries
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-[#5A5A62]">
                          Please sign in or create an account to continue with your project.
                        </p>
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <Link
                            to="/login?redirect=%2Fcontact&reason=project"
                            className="inline-flex h-11 items-center justify-center rounded-md bg-[#141416] px-5 text-sm font-medium text-white hover:bg-[#1D4ED8]"
                          >
                            Sign In
                          </Link>
                          <Link
                            to="/register?redirect=%2Fcontact&reason=project"
                            className="inline-flex h-11 items-center justify-center rounded-md border border-[#D4D4D8] bg-white px-5 text-sm font-medium text-[#141416] hover:border-[#141416]"
                          >
                            Create Account
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : confirmation ? (
                  <div className="vtx-panel-enter mt-8 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] p-6">
                    <div className="flex items-center gap-2.5 text-[#1D4ED8]">
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                      <span className="font-mono text-xs font-medium">
                        Enquiry Recorded · {confirmation.referenceId}
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-lg font-semibold text-[#141416]">
                      Thank you for contacting VERTYLEX.
                    </h3>
                    <p className="mt-2 text-sm text-[#5A5A62]">
                      Your enquiry has been saved under reference{' '}
                      <span className="font-mono font-medium text-[#141416]">
                        {confirmation.referenceId}
                      </span>
                      .
                      {confirmation.emailDelivered
                        ? ` It has also been forwarded to ${VERTYLEX_EMAIL}.`
                        : ' Our human support team will review your message shortly.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmation(null)}
                      className="mt-5 text-sm font-medium text-[#1D4ED8] hover:underline"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
                    {submitError && (
                      <div
                        role="alert"
                        className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                      >
                        {submitError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="contact-name"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Your name
                        </label>
                        <input
                          id="contact-name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Full name"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                        {errors.name && (
                          <p className="mt-1.5 text-xs text-red-700">{errors.name}</p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="contact-email"
                          className="block text-sm font-medium text-[#141416]"
                        >
                          Email address
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                        />
                        {errors.email && (
                          <p className="mt-1.5 text-xs text-red-700">{errors.email}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="contact-subject"
                        className="block text-sm font-medium text-[#141416]"
                      >
                        Subject
                      </label>
                      <input
                        id="contact-subject"
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="How can VERTYLEX help?"
                        className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                      />
                      {errors.subject && (
                        <p className="mt-1.5 text-xs text-red-700">{errors.subject}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="contact-message"
                        className="block text-sm font-medium text-[#141416]"
                      >
                        Message
                      </label>
                      <textarea
                        id="contact-message"
                        rows={5}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Share your questions or tell us briefly about your business..."
                        className="mt-2 w-full rounded-md border border-[#D4D4D8] p-3.5 text-sm leading-relaxed text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                      />
                      {errors.message && (
                        <p className="mt-1.5 text-xs text-red-700">{errors.message}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#141416] px-6 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                      {submitting ? 'Sending Message...' : 'Send Message'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
