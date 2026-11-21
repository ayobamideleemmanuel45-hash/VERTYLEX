import {ArrowRight, Check, Headphones, LayoutDashboard} from 'lucide-react';
import {useEffect} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';
import {ProjectJourneyStepper} from '../components/ProjectJourneyStepper';
import {useAuth} from '../context/AuthContext';
import {useProjectDraft} from '../context/ProjectDraftContext';
import {useSupport} from '../context/SupportContext';
import {normalizeToOrderService, ORDER_SERVICES} from '../data/vertylex';

export function ProjectServiceSelectPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {user} = useAuth();
  const {draft, setSelectedService} = useProjectDraft();
  const {openAssistant} = useSupport();

  const preselectedParam = normalizeToOrderService(searchParams.get('service'));

  useEffect(() => {
    if (preselectedParam) {
      setSelectedService(preselectedParam);
    }
  }, [preselectedParam, setSelectedService]);

  function handleSelectService(serviceTitle: string) {
    setSelectedService(serviceTitle);
    navigate('/submit-project/requirements');
  }

  return (
    <div className="bg-[#FAFAFA]">
      <ProjectJourneyStepper activeStep={1} />

      <section className="border-b border-[#E4E4E7] bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-[#1D4ED8]">
                Step 1 · Select Your Service
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#141416] sm:text-4xl [text-wrap:balance]">
                What would you like VERTYLEX to build or promote for you?
              </h1>
              <p className="mt-3 text-base leading-relaxed text-[#5A5A62]">
                Choose one of our service categories below to begin. On the next step, we will ask
                tailored questions for the exact service you selected.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                to="/account"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-4 text-xs font-medium text-[#141416] hover:border-[#141416] whitespace-nowrap"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-[#5A5A62]" aria-hidden="true" />
                Customer Dashboard
              </Link>
              <button
                type="button"
                onClick={() =>
                  openAssistant(
                    'I am choosing a VERTYLEX service and would like help picking the right category.',
                  )
                }
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[#E4E4E7] bg-white px-4 text-xs font-medium text-[#141416] hover:border-[#141416] whitespace-nowrap"
              >
                <Headphones className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                Ask Support
              </button>
            </div>
          </div>

          {user && (
            <p className="mt-5 text-xs text-[#5A5A62]">
              Signed in as <span className="font-medium text-[#141416]">{user.name}</span> (
              {user.email})
            </p>
          )}
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ORDER_SERVICES.map((service) => {
              const isSelected = draft.selectedService === service.title;

              return (
                <article
                  key={service.id}
                  className={`flex flex-col justify-between rounded-lg border p-7 transition-all duration-200 ease-out hover:-translate-y-0.5 ${
                    isSelected
                      ? 'scale-[1.01] border-[#1D4ED8] bg-white ring-1 ring-[#1D4ED8]/20 shadow-xs'
                      : 'border-[#E4E4E7] bg-white hover:border-[#141416]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-4">
                      <span className="font-mono text-xs font-medium text-[#1D4ED8] tabular-nums">
                        {service.index}
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8]">
                          <Check className="vtx-pop-in h-3.5 w-3.5" aria-hidden="true" />
                          Selected
                        </span>
                      )}
                    </div>

                    <h2 className="mt-5 font-display text-xl font-bold text-[#141416]">
                      {service.title}
                    </h2>
                    <p className="mt-2.5 text-sm leading-relaxed text-[#5A5A62]">
                      {service.shortDescription}
                    </p>

                    <p className="mt-4 text-xs text-[#5A5A62]">
                      {service.highlights.join(' · ')}
                    </p>
                  </div>

                  <div className="mt-7 border-t border-[#E4E4E7] pt-5">
                    <button
                      type="button"
                      onClick={() => handleSelectService(service.title)}
                      className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors duration-150 whitespace-nowrap ${
                        isSelected
                          ? 'bg-[#1D4ED8] text-white hover:bg-[#141416]'
                          : 'bg-[#141416] text-white hover:bg-[#1D4ED8]'
                      }`}
                    >
                      {isSelected ? 'Continue with This Service' : 'Select Service'}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
