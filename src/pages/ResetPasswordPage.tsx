import {Loader2} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {Link, useSearchParams} from 'react-router-dom';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Password reset token is missing or invalid.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({token, password}),
      });
      const data = (await res.json()) as {message?: string; error?: string};
      if (!res.ok) {
        throw new Error(data.error || 'Unable to reset password.');
      }
      setSuccess(data.message || 'Your password has been updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[#FAFAFA] py-16 sm:py-24">
      <div className="mx-auto max-w-md px-4 sm:px-6">
        <div className="rounded-lg border border-[#E4E4E7] bg-white p-8">
          <h1 className="font-display text-2xl font-bold text-[#141416]">Choose a new password</h1>
          <p className="mt-2 text-sm text-[#5A5A62]">
            Enter a new password for your VERTYLEX account.
          </p>

          {error && (
            <div
              role="alert"
              className="vtx-panel-enter mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
            >
              {error}
            </div>
          )}

          {success ? (
            <div className="vtx-panel-enter mt-6 space-y-4">
              <div className="rounded-md border border-[#E4E4E7] bg-[#F3F3F5] px-4 py-3 text-sm text-[#141416]">
                {success}
              </div>
              <Link
                to="/login"
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[#141416] px-4 text-sm font-medium text-white hover:bg-[#1D4ED8]"
              >
                Continue to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="vtx-panel-enter mt-6 space-y-5">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-[#141416]">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-[#141416]"
                >
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="mt-2 h-11 w-full rounded-md border border-[#D4D4D8] px-3.5 text-sm text-[#141416] focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#141416] px-4 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {submitting ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
