import {ArrowRight, Headphones} from 'lucide-react';
import {Link} from 'react-router-dom';
import {RevealSection} from '../components/RevealSection';
import {useSupport} from '../context/SupportContext';
import {HOW_IT_WORKS_STEPS, VERTYLEX_EMAIL} from '../data/vertylex';

export function HowItWorksPage() {
  const {openAssistant} = useSupport();

  return (
    <div className="bg-[#FAFAFA]">
      <section className="border-b border-[#E4E4E7] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-[#1D4ED8]">How It Works</p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-[#141416] sm:text-5xl [text-wrap:balance]">
              A straightforward five-step process from concept to collaboration.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-[#5A5A62] sm:text-lg">
              Starting a project with VERTYLEX is clear and accessible. Here is exactly what
              happens from the moment you choose a service to approving your quotation and kicking
              off.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <RevealSection className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <ol className="space-y-6">
            {HOW_IT_WORKS_STEPS.map((item) => (
              <li
                key={item.step}
                className="flex flex-col gap-4 rounded-lg border border-[#E4E4E7] bg-white p-8 sm:flex-row sm:items-start sm:gap-8"
              >
                <span className="font-mono text-2xl font-medium text-[#1D4ED8] tabular-nums shrink-0">
                  {item.step}
                </span>
                <div>
                  <h2 className="font-display text-xl font-bold text-[#141416]">{item.title}</h2>
                  <p className="mt-2.5 text-sm leading-relaxed text-[#5A5A62]">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-12 rounded-lg border border-[#E4E4E7] bg-white p-8">
            <h2 className="font-display text-xl font-bold text-[#141416]">
              Ready for Step 1?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5A5A62]">
              You can submit your project details online right now, ask VERTYLEX Assistant a
              question, or email us at{' '}
              <span className="font-medium text-[#141416]">{VERTYLEX_EMAIL}</span>.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                to="/submit-project"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-[#141416] px-5 text-sm font-medium text-white hover:bg-[#1D4ED8]"
              >
                Submit Your Project
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/services"
                className="inline-flex h-11 items-center rounded-md border border-[#E4E4E7] bg-white px-5 text-sm font-medium text-[#141416] hover:border-[#141416]"
              >
                Browse Services
              </Link>
              <button
                type="button"
                onClick={() => openAssistant()}
                className="inline-flex h-11 items-center gap-2 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-5 text-sm font-medium text-[#141416] hover:border-[#141416]"
              >
                <Headphones className="h-4 w-4 text-[#1D4ED8]" aria-hidden="true" />
                VERTYLEX Assistant
              </button>
            </div>
          </div>
        </RevealSection>
      </section>
    </div>
  );
}
