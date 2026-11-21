import {ArrowUpRight, Headphones, LogOut, Mail, Menu, ShieldCheck, X} from 'lucide-react';
import {useEffect, useState, type ReactNode} from 'react';
import {Link, NavLink, useLocation, useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useSupport} from '../context/SupportContext';
import {getMailtoUrl, getOfficialWhatsAppUrl, SERVICE_CATEGORIES, VERTYLEX_EMAIL} from '../data/vertylex';
import {NotificationBell} from './NotificationBell';
import {RegionSelector} from './RegionSelector';
import {VertylexAssistant} from './VertylexAssistant';

const NAV_LINKS = [
  {to: '/services', label: 'Services'},
  {to: '/business-solutions', label: 'Solutions'},
  {to: '/how-it-works', label: 'How It Works'},
  {to: '/about', label: 'About'},
  {to: '/contact', label: 'Contact'},
];

export function Layout({children}: {children: ReactNode}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {user, isAdmin, loading, logout} = useAuth();
  const {integrations, openAssistant} = useSupport();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileMenuOpen(false);
    if (location.hash) {
      const id = location.hash.slice(1);
      requestAnimationFrame(() => {
        const targetEl = document.getElementById(id);
        if (targetEl) {
          targetEl.scrollIntoView({behavior: 'smooth'});
        }
      });
      return;
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  async function handleSignOut() {
    await logout();
    setMobileMenuOpen(false);
    navigate('/');
  }

  const officialWaUrl = integrations.whatsapp.configured
    ? getOfficialWhatsAppUrl(integrations.whatsapp.officialUrl)
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAFA] text-[#141416]">
      <header className="sticky top-0 z-40 border-b border-[#E4E4E7] bg-[#FAFAFA]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-[#141416] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1D4ED8]"
          >
            VERTYLEX
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-7 md:flex"
          >
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({isActive}) =>
                  `relative py-1 text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1D4ED8] ${
                    isActive
                      ? 'text-[#141416] after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-[#1D4ED8]'
                      : 'text-[#5A5A62] hover:text-[#141416]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 shrink-0 md:flex">
            {!loading &&
              (user ? (
                <div className="flex items-center gap-3">
                  <NotificationBell mode={isAdmin && user.role === 'admin' ? 'admin' : 'customer'} />
                  {isAdmin && user.role === 'admin' && (
                    <Link
                      to="/admin"
                      className="inline-flex items-center gap-1 rounded-md border border-[#1D4ED8]/30 bg-[#1D4ED8]/[0.06] px-2.5 py-1.5 text-xs font-medium text-[#1D4ED8] transition-colors hover:bg-[#1D4ED8] hover:text-white whitespace-nowrap shrink-0"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Admin
                    </Link>
                  )}
                  <Link
                    to="/account"
                    className="max-w-[140px] truncate text-sm font-medium text-[#141416] transition-colors duration-150 hover:text-[#1D4ED8] whitespace-nowrap shrink-0"
                  >
                    {user.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#5A5A62] transition-colors duration-150 hover:text-[#141416] whitespace-nowrap shrink-0"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="text-sm font-medium text-[#5A5A62] transition-colors duration-150 hover:text-[#141416] whitespace-nowrap shrink-0"
                >
                  Sign In
                </Link>
              ))}
            <Link
              to="/submit-project"
              className="inline-flex h-9 items-center justify-center rounded-md bg-[#141416] px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
            >
              Start Project
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#E4E4E7] bg-white text-[#141416] md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <div
          aria-hidden={!mobileMenuOpen}
          className={`grid border-t border-[#E4E4E7] bg-white transition-[grid-template-rows,opacity] duration-200 ease-out md:hidden ${
            mobileMenuOpen
              ? 'grid-rows-[1fr] opacity-100'
              : 'pointer-events-none overflow-hidden grid-rows-[0fr] border-t-transparent opacity-0'
          }`}
        >
          <div className="min-h-0">
            <div className="px-4 py-5">
              <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
                <Link
                  to="/"
                  tabIndex={mobileMenuOpen ? 0 : -1}
                  className="flex h-11 items-center rounded-md px-3 text-sm font-medium text-[#141416] hover:bg-[#F3F3F5]"
                >
                  Home
                </Link>
                {NAV_LINKS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    tabIndex={mobileMenuOpen ? 0 : -1}
                    className="flex h-11 items-center rounded-md px-3 text-sm font-medium text-[#141416] hover:bg-[#F3F3F5]"
                  >
                    {item.label}
                  </Link>
                ))}
                {user ? (
                  <>
                    <Link
                      to="/account"
                      tabIndex={mobileMenuOpen ? 0 : -1}
                      className="flex h-11 items-center rounded-md px-3 text-sm font-medium text-[#1D4ED8] hover:bg-[#F3F3F5]"
                    >
                      Dashboard ({user.name})
                    </Link>
                    {isAdmin && user.role === 'admin' && (
                      <Link
                        to="/admin"
                        tabIndex={mobileMenuOpen ? 0 : -1}
                        className="flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-[#141416] hover:bg-[#F3F3F5]"
                      >
                        <ShieldCheck className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                        Private Admin Dashboard
                      </Link>
                    )}
                    <button
                      type="button"
                      tabIndex={mobileMenuOpen ? 0 : -1}
                      onClick={() => void handleSignOut()}
                      className="flex h-11 items-center gap-2 rounded-md px-3 text-left text-sm font-medium text-[#5A5A62] hover:bg-[#F3F3F5] hover:text-[#141416]"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      tabIndex={mobileMenuOpen ? 0 : -1}
                      className="flex h-11 items-center rounded-md px-3 text-sm font-medium text-[#141416] hover:bg-[#F3F3F5]"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      tabIndex={mobileMenuOpen ? 0 : -1}
                      className="flex h-11 items-center rounded-md px-3 text-sm font-medium text-[#141416] hover:bg-[#F3F3F5]"
                    >
                      Create Account
                    </Link>
                  </>
                )}
              </nav>

              <div className="mt-4 border-t border-[#E4E4E7] pt-4">
                <RegionSelector showRateMeta />
              </div>

              <div className="mt-4 flex flex-col gap-2.5 border-t border-[#E4E4E7] pt-4">
                <Link
                  to="/submit-project"
                  tabIndex={mobileMenuOpen ? 0 : -1}
                  className="inline-flex h-11 items-center justify-center rounded-md bg-[#141416] px-4 text-sm font-medium text-white"
                >
                  Start Your Project
                </Link>
                <button
                  type="button"
                  tabIndex={mobileMenuOpen ? 0 : -1}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAssistant();
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-4 text-sm font-medium text-[#141416]"
                >
                  <Headphones className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                  VERTYLEX Assistant
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div key={location.pathname} className="vtx-page-enter">
          {children}
        </div>
      </main>

      <VertylexAssistant />

      <footer className="border-t border-[#E4E4E7] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            <div className="md:col-span-4">
              <Link
                to="/"
                className="font-display text-xl font-bold tracking-tight text-[#141416]"
              >
                VERTYLEX
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#5A5A62]">
                A digital creative and business development company helping individuals,
                entrepreneurs, and businesses worldwide turn ideas into market-ready reality.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => openAssistant()}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#141416] px-4 text-xs font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] whitespace-nowrap"
                >
                  <Headphones className="h-4 w-4" aria-hidden="true" />
                  VERTYLEX Assistant
                </button>
                <a
                  href={getMailtoUrl('Project Enquiry for VERTYLEX')}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-4 text-xs font-medium text-[#141416] transition-colors duration-150 hover:border-[#141416] whitespace-nowrap"
                >
                  <Mail className="h-4 w-4 text-[#5A5A62]" aria-hidden="true" />
                  Email Us
                </a>
              </div>

              {officialWaUrl && (
                <a
                  href={officialWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] hover:underline"
                >
                  Continue via Official WhatsApp Business
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </div>

            <div className="md:col-span-2">
              <h2 className="text-sm font-semibold text-[#141416]">Navigation</h2>
              <ul className="mt-4 space-y-2.5 text-sm text-[#5A5A62]">
                <li>
                  <Link to="/" className="hover:text-[#141416] transition-colors">
                    Homepage
                  </Link>
                </li>
                <li>
                  <Link to="/services" className="hover:text-[#141416] transition-colors">
                    Services
                  </Link>
                </li>
                <li>
                  <Link to="/business-solutions" className="hover:text-[#141416] transition-colors">
                    Business Solutions
                  </Link>
                </li>
                <li>
                  <Link to="/submit-project" className="hover:text-[#141416] transition-colors">
                    Project Submission
                  </Link>
                </li>
                <li>
                  <Link to="/how-it-works" className="hover:text-[#141416] transition-colors">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="hover:text-[#141416] transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-[#141416] transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-3">
              <h2 className="text-sm font-semibold text-[#141416]">Services</h2>
              <ul className="mt-4 space-y-2.5 text-sm text-[#5A5A62]">
                {SERVICE_CATEGORIES.map((service) => (
                  <li key={service.slug}>
                    <Link
                      to={`/services/${service.slug}`}
                      className="hover:text-[#141416] transition-colors"
                    >
                      {service.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-3">
              <h2 className="text-sm font-semibold text-[#141416]">Region &amp; Support</h2>
              <div className="mt-4 space-y-5 text-sm">
                <RegionSelector showRateMeta />

                <div>
                  <p className="text-xs font-medium text-[#5A5A62]">Official Email</p>
                  <a
                    href={getMailtoUrl('Enquiry for VERTYLEX')}
                    className="mt-1 inline-block font-medium text-[#141416] underline decoration-[#E4E4E7] underline-offset-4 hover:decoration-[#1D4ED8]"
                  >
                    {VERTYLEX_EMAIL}
                  </a>
                </div>

                <div className="border-t border-[#E4E4E7] pt-3">
                  <p className="text-xs font-medium text-[#5A5A62]">Client Access</p>
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    {user ? (
                      <>
                        <Link
                          to="/account"
                          className="font-medium text-[#1D4ED8] hover:underline"
                        >
                          Customer Dashboard
                        </Link>
                        <span className="text-[#D4D4D8]" aria-hidden="true">
                          /
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleSignOut()}
                          className="text-[#5A5A62] hover:text-[#141416]"
                        >
                          Sign Out
                        </button>
                      </>
                    ) : (
                      <>
                        <Link to="/login" className="text-[#141416] hover:text-[#1D4ED8]">
                          Login
                        </Link>
                        <span className="text-[#D4D4D8]" aria-hidden="true">
                          /
                        </span>
                        <Link to="/register" className="text-[#141416] hover:text-[#1D4ED8]">
                          Register
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-[#E4E4E7] pt-8 text-xs text-[#5A5A62] sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} VERTYLEX. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link to="/submit-project" className="hover:text-[#141416]">
                Submit a Project
              </Link>
              <span aria-hidden="true">·</span>
              <Link to="/contact" className="hover:text-[#141416]">
                Customer Support
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
