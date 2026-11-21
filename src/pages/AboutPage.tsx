import {ArrowRight, Headphones, Mail} from 'lucide-react';
import {Link} from 'react-router-dom';
import {MediaFrame} from '../components/MediaFrame';
import {RevealSection} from '../components/RevealSection';
import {useSupport} from '../context/SupportContext';
import {getMailtoUrl, SERVICE_CATEGORIES, VERTYLEX_EMAIL} from '../data/vertylex';

const PRINCIPLES = [
  {
    index: '01',
    title: 'Clarity First',
    description:
      'Every engagement starts by understanding what the business actually needs to achieve—before choosing visuals, advertising channels, or technical tools.',
  },
  {
    index: '02',
    title: 'Cohesive Execution',
    description:
      'Your flyers, brand identity, advertisements, website, and mobile application should look and speak like one unified company.',
  },
  {
    index: '03',
    title: 'Practical Craftsmanship',
    description:
      'We focus on clean typography, reliable software engineering, and clear customer messaging rather than fleeting trends or unnecessary complexity.',
  },
];

export function AboutPage() {
  const {openAssistant} = useSupport();

  return (
    <div className="bg-[#FAFAFA]">
      <section className="border-b border-[#E4E4E7] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-[#1D4ED8]">About Us</p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-[#141416] sm:text-5xl [text-wrap:balance]">
              Helping individuals and businesses turn good ideas into built reality.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-[#5A5A62] sm:text-lg">
              VERTYLEX is a digital creative and business development company built around a simple
              conviction: strong ideas should not stall because strategy, design, promotion, and
              software feel fragmented or out of reach.
            </p>
          </div>

          <div className="mt-12">
            <MediaFrame
              src="/src/assets/images/about_collaboration_workspace_1795243710209.jpg"
              alt="VERTYLEX team collaborating over brand strategy and product layouts"
              aspectClass="aspect-[16/9]"
              className="rounded-lg"
              priority
            />
          </div>
        </div>
      </section>

      <section className="border-b border-[#E4E4E7] bg-[#FAFAFA] py-16 sm:py-20">
        <RevealSection className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h2 className="font-display text-3xl font-bold text-[#141416]">Our Purpose</h2>
              <p className="mt-4 text-sm leading-relaxed text-[#5A5A62]">
                Entrepreneurs and established business owners regularly face the same challenge: an
                idea for a company, product, campaign, or digital platform exists, yet turning it
                into real promotional assets, a credible brand identity, and working web or mobile
                software requires coordinating multiple skills.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-[#5A5A62]">
                VERTYLEX brings those disciplines into one focused practice—covering business
                development, advertising, graphic design, websites, applications, and brand growth.
              </p>
            </div>

            <div className="space-y-6 lg:col-span-7">
              {PRINCIPLES.map((principle) => (
                <div
                  key={principle.index}
                  className="rounded-lg border border-[#E4E4E7] bg-white p-6"
                >
                  <span className="font-mono text-xs text-[#1D4ED8] tabular-nums">
                    {principle.index}
                  </span>
                  <h3 className="mt-2 font-display text-lg font-semibold text-[#141416]">
                    {principle.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5A5A62]">
                    {principle.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </RevealSection>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <RevealSection className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 border-b border-[#E4E4E7] pb-6 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#141416]">
                Our Six Practice Areas
              </h2>
              <p className="mt-1 text-sm text-[#5A5A62]">
                Explore each capability in detail or start a project enquiry directly.
              </p>
            </div>
            <Link
              to="/submit-project"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#141416] px-4 text-xs font-medium text-white hover:bg-[#1D4ED8] whitespace-nowrap shrink-0"
            >
              Start Your Project
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_CATEGORIES.map((service) => (
              <Link
                key={service.slug}
                to={`/services/${service.slug}`}
                className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-6 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#141416] hover:bg-white hover:shadow-xs"
              >
                <span className="font-mono text-xs text-[#5A5A62] tabular-nums">
                  {service.index}
                </span>
                <h3 className="mt-2 font-display text-lg font-semibold text-[#141416]">
                  {service.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5A5A62]">{service.summary}</p>
              </Link>
            ))}
          </div>

          <div className="mt-14 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] p-8">
            <h3 className="font-display text-xl font-bold text-[#141416]">Connect With VERTYLEX</h3>
            <p className="mt-2 text-sm text-[#5A5A62]">
              Chat with VERTYLEX Assistant or email our team directly to discuss a new idea or
              ongoing requirement.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => openAssistant()}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-[#141416] px-5 text-sm font-medium text-white hover:bg-[#1D4ED8]"
              >
                <Headphones className="h-4 w-4" aria-hidden="true" />
                Open VERTYLEX Assistant
              </button>
              <a
                href={getMailtoUrl('Enquiry for VERTYLEX')}
                className="inline-flex h-11 items-center gap-2 rounded-md border border-[#E4E4E7] bg-white px-5 text-sm font-medium text-[#141416] hover:border-[#141416]"
              >
                <Mail className="h-4 w-4 text-[#5A5A62]" aria-hidden="true" />
                {VERTYLEX_EMAIL}
              </a>
            </div>
          </div>
        </RevealSection>
      </section>
    </div>
  );
}
