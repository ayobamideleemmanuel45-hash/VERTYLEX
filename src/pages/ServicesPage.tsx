import {ArrowRight, Headphones} from 'lucide-react';
import {useState} from 'react';
import {Link} from 'react-router-dom';
import {RevealSection} from '../components/RevealSection';
import {useSupport} from '../context/SupportContext';
import {SERVICE_CATEGORIES} from '../data/vertylex';

type FilterGroup = 'all' | 'strategy' | 'creative' | 'technology';

const FILTER_MAP: Record<FilterGroup, string[]> = {
  all: SERVICE_CATEGORIES.map((s) => s.slug),
  strategy: ['business-development', 'branding-and-growth'],
  creative: ['advertising-and-promotion', 'graphic-design'],
  technology: ['website-development', 'application-development'],
};

const FILTER_LABELS: {id: FilterGroup; label: string}[] = [
  {id: 'all', label: 'All Services'},
  {id: 'strategy', label: 'Strategy & Growth'},
  {id: 'creative', label: 'Advertising & Design'},
  {id: 'technology', label: 'Web & Applications'},
];

export function ServicesPage() {
  const [activeFilter, setActiveFilter] = useState<FilterGroup>('all');
  const {openAssistant} = useSupport();
  const visibleServices = SERVICE_CATEGORIES.filter((s) =>
    FILTER_MAP[activeFilter].includes(s.slug),
  );

  return (
    <div className="bg-[#FAFAFA]">
      <section className="border-b border-[#E4E4E7] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-[#1D4ED8]">Services</p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-[#141416] sm:text-5xl [text-wrap:balance]">
              Practical capabilities for building and promoting your business.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-[#5A5A62] sm:text-lg">
              Select a service category below to inspect deliverables, scope, and how to request a
              project with VERTYLEX.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filter services by discipline"
            className="mt-10 inline-flex flex-wrap items-center gap-1 rounded-lg border border-[#E4E4E7] bg-[#F3F3F5] p-1"
          >
            {FILTER_LABELS.map((tab) => {
              const active = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`h-9 rounded-md px-4 text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-[#141416] shadow-xs'
                      : 'text-[#5A5A62] hover:text-[#141416]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div key={activeFilter} className="vtx-panel-enter grid grid-cols-1 gap-8 md:grid-cols-2">
            {visibleServices.map((service) => (
              <article
                key={service.slug}
                className="flex flex-col justify-between rounded-lg border border-[#E4E4E7] bg-white p-8 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#141416] hover:shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-4">
                    <span className="font-mono text-xs font-medium text-[#1D4ED8] tabular-nums">
                      Service {service.index}
                    </span>
                    <Link
                      to={`/services/${service.slug}`}
                      className="text-xs font-medium text-[#5A5A62] hover:text-[#141416]"
                    >
                      View details →
                    </Link>
                  </div>

                  <h2 className="mt-6 font-display text-2xl font-bold text-[#141416]">
                    {service.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-[#5A5A62]">{service.overview}</p>

                  <div className="mt-6 space-y-3 border-t border-[#E4E4E7] pt-6">
                    <h3 className="text-xs font-semibold text-[#141416]">Included Areas</h3>
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {service.offerings.map((offering) => (
                        <li key={offering.title} className="text-sm">
                          <span className="font-medium text-[#141416]">{offering.title}</span>
                          <p className="mt-0.5 text-xs leading-relaxed text-[#5A5A62]">
                            {offering.description}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[#E4E4E7] pt-6">
                  {service.slug === 'website-development' ? (
                    <Link
                      to="/services/website-development#build-website"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#141416] px-4 text-xs font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] whitespace-nowrap"
                    >
                      Build My Website
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  ) : (
                    <Link
                      to={`/submit-project/requirements?service=${encodeURIComponent(service.title)}`}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#141416] px-4 text-xs font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] whitespace-nowrap"
                    >
                      Request {service.shortTitle}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  )}
                  <Link
                    to={`/services/${service.slug}`}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-[#E4E4E7] bg-white px-4 text-xs font-medium text-[#141416] transition-colors duration-150 hover:border-[#141416] whitespace-nowrap"
                  >
                    Service Page
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <RevealSection className="mt-14 flex flex-col items-start justify-between gap-6 rounded-lg border border-[#E4E4E7] bg-white p-8 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-xl font-bold text-[#141416]">
                Not sure which service fits your idea best?
              </h2>
              <p className="mt-1.5 text-sm text-[#5A5A62]">
                Ask VERTYLEX Assistant for guidance or submit a general project brief for review.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => openAssistant('Help me choose the right VERTYLEX service for my idea.')}
                className="inline-flex h-11 items-center gap-2 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-4 text-sm font-medium text-[#141416] hover:border-[#141416] whitespace-nowrap"
              >
                <Headphones className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                Ask VERTYLEX Assistant
              </button>
              <Link
                to="/submit-project"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-[#141416] px-5 text-sm font-medium text-white hover:bg-[#1D4ED8] whitespace-nowrap"
              >
                Submit Project
              </Link>
            </div>
          </RevealSection>
        </div>
      </section>
    </div>
  );
}
