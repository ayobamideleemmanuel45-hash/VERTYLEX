import {ArrowRight, ArrowUpRight, Headphones, Mail} from 'lucide-react';
import {Link} from 'react-router-dom';
import {MediaFrame} from '../components/MediaFrame';
import {RevealSection} from '../components/RevealSection';
import {useSupport} from '../context/SupportContext';
import {
  getMailtoUrl,
  getOfficialWhatsAppUrl,
  HOW_IT_WORKS_STEPS,
  SERVICE_CATEGORIES,
  VERTYLEX_EMAIL,
} from '../data/vertylex';

const WHY_VERTYLEX = [
  {
    index: '01',
    title: 'Strategy, Design, and Engineering Together',
    description:
      'Rather than splitting business planning, graphic design, advertising, and software across disconnected freelancers, VERTYLEX coordinates every discipline around one unified direction.',
  },
  {
    index: '02',
    title: 'Plain-Language Collaboration',
    description:
      'You do not need technical jargon or formal specifications to start. Explain your business goals in your own words, and we translate them into clear deliverables.',
  },
  {
    index: '03',
    title: 'Transparent Quotations & Global Support',
    description:
      'Submit your project requirements first, review a clear quotation in your preferred regional currency, and proceed to secure payment only when you approve the proposal.',
  },
  {
    index: '04',
    title: 'Guided Human & Assistant Support',
    description:
      'Ask questions anytime through VERTYLEX Assistant, connect via official support channels, or collaborate through your personal Customer Dashboard.',
  },
];

export function HomePage() {
  const {integrations, openAssistant} = useSupport();
  const officialWaUrl = integrations.whatsapp.configured
    ? getOfficialWhatsAppUrl(integrations.whatsapp.officialUrl)
    : null;

  return (
    <div>
      {/* Hero Section */}
      <section className="border-b border-[#E4E4E7] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-[#1D4ED8]">
              Digital Creative &amp; Business Development
            </p>
            <h1 className="mt-4 font-display text-[clamp(2.25rem,4.2vw,3.75rem)] font-bold leading-[1.08] tracking-tight text-[#141416] [text-wrap:balance]">
              Your Ideas Deserve More. Let&apos;s Build Them.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#5A5A62] sm:text-lg">
              VERTYLEX helps individuals, entrepreneurs, and growing companies turn early ideas into
              structured businesses—combining business development, advertising, graphic design,
              website engineering, mobile applications, and cohesive brand growth.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/submit-project"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#141416] px-6 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] whitespace-nowrap shrink-0"
              >
                Start Your Project
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/services"
                className="inline-flex h-12 items-center justify-center rounded-md border border-[#D4D4D8] bg-white px-6 text-sm font-medium text-[#141416] transition-colors duration-150 hover:border-[#141416] whitespace-nowrap shrink-0"
              >
                Explore Services
              </Link>
            </div>
          </div>

          <div className="mt-14">
            <MediaFrame
              src="/src/assets/images/hero_vertylex_studio_1795243709420.jpg"
              alt="VERTYLEX strategy and digital creative studio workspace"
              aspectClass="aspect-[16/9]"
              className="rounded-lg"
              priority
            />
          </div>
        </div>
      </section>

      {/* Featured Services Asymmetric Showcase */}
      <section className="border-b border-[#E4E4E7] bg-[#FAFAFA] py-20 sm:py-24">
        <RevealSection className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 border-b border-[#E4E4E7] pb-8 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-[#5A5A62]">Core Capabilities</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#141416] sm:text-4xl [text-wrap:balance]">
                Six integrated disciplines to launch, promote, and scale your business.
              </h2>
            </div>
            <Link
              to="/services"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#1D4ED8] hover:underline whitespace-nowrap shrink-0"
            >
              View all services
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Marquee Visual Card 1 */}
            <div className="flex flex-col justify-between rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-8 lg:col-span-7">
              <div>
                <MediaFrame
                  src="/src/assets/images/service_digital_product_1795243709642.jpg"
                  alt="Website and mobile application interface design on laptop and smartphone"
                  aspectClass="aspect-[16/10]"
                  className="rounded-md"
                />
                <div className="mt-6 flex items-baseline justify-between gap-4">
                  <h3 className="font-display text-xl font-semibold text-[#141416]">
                    04. Website &amp; Application Development
                  </h3>
                  <span className="font-mono text-xs text-[#5A5A62] tabular-nums shrink-0">
                    Web · Mobile · Custom
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#5A5A62]">
                  From responsive company websites and campaign landing pages to custom mobile and
                  business applications engineered around real customer workflows.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-6 border-t border-[#E4E4E7] pt-5 text-sm font-medium">
                <Link
                  to="/services/website-development#build-website"
                  className="text-[#141416] hover:text-[#1D4ED8] transition-colors"
                >
                  Build My Website →
                </Link>
                <Link
                  to="/services/application-development"
                  className="text-[#141416] hover:text-[#1D4ED8] transition-colors"
                >
                  Application Development →
                </Link>
              </div>
            </div>

            {/* Marquee Visual Card 2 */}
            <div className="flex flex-col justify-between rounded-lg border border-[#E4E4E7] bg-white p-6 sm:p-8 lg:col-span-5">
              <div>
                <MediaFrame
                  src="/src/assets/images/service_brand_design_1795243710695.jpg"
                  alt="Brand stationery, promotional print brochures, and graphic design grids"
                  aspectClass="aspect-[4/3]"
                  className="rounded-md"
                />
                <h3 className="mt-6 font-display text-xl font-semibold text-[#141416]">
                  03. Graphic Design &amp; Promotion
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#5A5A62]">
                  Business flyers, posters, product graphics, social media designs, and structured
                  advertising campaigns that present your offer with clarity.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-6 border-t border-[#E4E4E7] pt-5 text-sm font-medium">
                <Link
                  to="/services/graphic-design"
                  className="text-[#141416] hover:text-[#1D4ED8] transition-colors"
                >
                  Graphic Design →
                </Link>
                <Link
                  to="/services/advertising-and-promotion"
                  className="text-[#141416] hover:text-[#1D4ED8] transition-colors"
                >
                  Advertising →
                </Link>
              </div>
            </div>

            {/* Remaining Capabilities Structured Grid */}
            {SERVICE_CATEGORIES.map((service) => (
              <Link
                key={service.slug}
                to={`/services/${service.slug}`}
                className="group flex flex-col justify-between rounded-lg border border-[#E4E4E7] bg-white p-6 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#141416] hover:shadow-xs lg:col-span-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-medium text-[#5A5A62] tabular-nums">
                      {service.index}
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 text-[#5A5A62] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#141416]"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-[#141416]">
                    {service.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5A5A62]">{service.summary}</p>
                </div>
                <p className="mt-5 border-t border-[#E4E4E7] pt-4 text-xs text-[#5A5A62]">
                  {service.offerings.map((o) => o.title).join(' · ')}
                </p>
              </Link>
            ))}
          </div>
        </RevealSection>
      </section>

      {/* Why Choose VERTYLEX */}
      <section className="border-b border-[#E4E4E7] bg-white py-20 sm:py-24">
        <RevealSection className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="text-sm font-medium text-[#1D4ED8]">Why Choose VERTYLEX</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-[#141416] [text-wrap:balance]">
                Built for clarity, accountability, and real business progress.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[#5A5A62]">
                Whether you are starting from a single notebook sketch or upgrading an established
                company, our process turns uncertainty into clear, step-by-step execution.
              </p>
              <div className="mt-8">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#141416] underline decoration-[#D4D4D8] underline-offset-4 hover:decoration-[#1D4ED8]"
                >
                  Read about our approach
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:col-span-8">
              {WHY_VERTYLEX.map((item) => (
                <div key={item.index} className="border-t border-[#E4E4E7] pt-6">
                  <span className="font-mono text-xs font-medium text-[#1D4ED8] tabular-nums">
                    {item.index}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-semibold text-[#141416]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5A5A62]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </RevealSection>
      </section>

      {/* How It Works Preview */}
      <section className="border-b border-[#E4E4E7] bg-[#FAFAFA] py-20 sm:py-24">
        <RevealSection className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <p className="text-sm font-medium text-[#5A5A62]">How It Works</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#141416] [text-wrap:balance]">
                From idea to kickoff in five straightforward steps.
              </h2>
            </div>
            <Link
              to="/how-it-works"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#141416] hover:text-[#1D4ED8] whitespace-nowrap shrink-0"
            >
              See full process
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-5">
            {HOW_IT_WORKS_STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-lg border border-[#E4E4E7] bg-white p-5"
              >
                <span className="font-mono text-xs font-medium text-[#1D4ED8] tabular-nums">
                  Step {item.step}
                </span>
                <h3 className="mt-3 font-display text-base font-semibold text-[#141416]">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#5A5A62]">{item.description}</p>
              </div>
            ))}
          </div>
        </RevealSection>
      </section>

      {/* Professional Closing Section */}
      <section className="bg-[#141416] py-20 text-white sm:py-24">
        <RevealSection className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl [text-wrap:balance]">
                Ready to turn your concept into a credible business asset?
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-[#D4D4D8]">
                Submit your project details online for a structured review and quotation, or chat
                with VERTYLEX Assistant to get guidance right away.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/submit-project"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-white px-6 text-sm font-medium text-[#141416] transition-colors duration-150 hover:bg-[#E4E4E7] whitespace-nowrap shrink-0"
                >
                  Start Your Project
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() => openAssistant()}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/25 px-5 text-sm font-medium text-white transition-colors duration-150 hover:border-white whitespace-nowrap shrink-0"
                >
                  <Headphones className="h-4 w-4" aria-hidden="true" />
                  Chat with VERTYLEX Assistant
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-white/15 bg-white/5 p-6 sm:p-8 lg:col-span-5">
              <h3 className="font-display text-lg font-semibold text-white">
                Direct Customer Support
              </h3>
              <dl className="mt-5 space-y-5 text-sm">
                <div>
                  <dt className="text-xs text-[#A1A1AA]">Official Email</dt>
                  <dd className="mt-1">
                    <a
                      href={getMailtoUrl('Project Discussion with VERTYLEX')}
                      className="inline-flex items-center gap-2 font-medium text-white hover:underline"
                    >
                      <Mail className="h-4 w-4 text-[#A1A1AA]" aria-hidden="true" />
                      {VERTYLEX_EMAIL}
                    </a>
                  </dd>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <dt className="text-xs text-[#A1A1AA]">Customer Support Desk</dt>
                  <dd className="mt-1">
                    {officialWaUrl ? (
                      <a
                        href={officialWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 font-medium text-white hover:underline"
                      >
                        Official WhatsApp Business Channel
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAssistant()}
                        className="inline-flex items-center gap-2 font-medium text-white hover:underline"
                      >
                        <Headphones className="h-4 w-4 text-[#A1A1AA]" aria-hidden="true" />
                        Open VERTYLEX Assistant &amp; Human Support
                      </button>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </RevealSection>
      </section>
    </div>
  );
}
