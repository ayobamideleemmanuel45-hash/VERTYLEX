import {Check} from 'lucide-react';

const JOURNEY_STEPS = [
  {number: 1, label: 'Select Your Service'},
  {number: 2, label: 'Project Requirements'},
  {number: 3, label: 'Review Your Project'},
  {number: 4, label: 'Quotation'},
  {number: 5, label: 'Payment'},
  {number: 6, label: 'Customer Dashboard'},
] as const;

export function ProjectJourneyStepper({activeStep}: {activeStep: 1 | 2 | 3 | 4 | 5 | 6}) {
  return (
    <nav aria-label="Project ordering steps" className="border-b border-[#E4E4E7] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {JOURNEY_STEPS.map((step) => {
            const completed = step.number < activeStep;
            const current = step.number === activeStep;
            return (
              <li
                key={step.number}
                aria-current={current ? 'step' : undefined}
                className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 transition-colors duration-150 ${
                  current
                    ? 'border-[#1D4ED8] bg-[#1D4ED8]/[0.04]'
                    : completed
                      ? 'border-[#E4E4E7] bg-[#FAFAFA]'
                      : 'border-[#E4E4E7] bg-white opacity-70'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold tabular-nums ${
                    current
                      ? 'bg-[#1D4ED8] text-white'
                      : completed
                        ? 'bg-[#141416] text-white'
                        : 'border border-[#D4D4D8] bg-[#FAFAFA] text-[#5A5A62]'
                  }`}
                >
                  {completed ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : `0${step.number}`}
                </span>
                <span
                  className={`truncate text-xs font-medium ${
                    current ? 'text-[#141416]' : completed ? 'text-[#141416]' : 'text-[#5A5A62]'
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
