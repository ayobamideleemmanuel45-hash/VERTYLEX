import {ArrowRight, Headphones} from 'lucide-react';
import {Link} from 'react-router-dom';
import {MediaFrame} from '../components/MediaFrame';
import {RevealSection} from '../components/RevealSection';
import {useSupport} from '../context/SupportContext';

const SOLUTION_TRACKS = [
  {
    index: '01',
    stage: 'Early-Stage Founders & New Ventures',
    title: 'Idea-to-Launch Business Foundation',
    summary:
      'Designed for individuals with a strong business idea who need structured planning, a credible brand identity, promotional flyers, and a launch website in one coordinated sequence.',
    included: [
      'Business concept refinement and practical launch planning',
      'Core brand identity, business name positioning, and stationery',
      'Launch flyers, social media starter graphics, and product visuals',
      'Responsive business website with customer enquiry capture',
    ],
    recommendedService: 'Business Development',
  },
  {
    index: '02',
    stage: 'Growing Businesses & Established Companies',
    title: 'Digital Presence Upgrade & Rebrand',
    summary:
      'Built for active companies whose current online presence, visuals, or customer communication no longer reflect the quality of their work.',
    included: [
      'Cohesive brand identity refresh and visual consistency rules',
      'Modern company website structured around clear service conversion',
      'Targeted business advertisements and promotional campaign assets',
      'Ongoing marketing and creative assistance as your business expands',
    ],
    recommendedService: 'Branding and Growth',
  },
  {
    index: '03',
    stage: 'Product Sellers & Service Campaigns',
    title: 'Product Promotion & Conversion Push',
    summary:
      'Focused on getting a specific product, offer, or seasonal promotion in front of buyers with persuasive visuals and dedicated landing pages.',
    included: [
      'Product graphics, posters, and high-clarity promotional flyers',
      'Dedicated product or campaign landing page built for fast action',
      'Social media advertising creative formatted across major channels',
      'Direct customer lead capture and support workflows',
    ],
    recommendedService: 'Advertising and Promotion',
  },
  {
    index: '04',
    stage: 'Operations & Custom Digital Products',
    title: 'Custom Web & Mobile Application Systems',
    summary:
      'Tailored for entrepreneurs building digital products or companies replacing manual spreadsheets and fragmented tools with dedicated applications.',
    included: [
      'Scope definition, user flow planning, and technical architecture',
      'Custom mobile applications and business operations portals',
      'Secure user accounts, role permissions, and persistent databases',
      'Post-launch iteration and structured maintenance planning',
    ],
    recommendedService: 'Application Development',
  },
];

export function BusinessSolutionsPage() {
  const {openAssistant} = useSupport();

  return (
    <div className="bg-[#FAFAFA]">
      <section className="border-b border-[#E4E4E7] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="text-sm font-medium text-[#1D4ED8]">Business Solutions</p>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-[#141416] sm:text-5xl [text-wrap:balance]">
                Structured pathways matched to where your business stands today.
              </h1>
              <p className="mt-5 text-base leading-relaxed text-[#5A5A62] sm:text-lg">
                Many clients need more than a single isolated deliverable. Explore how VERTYLEX
                combines business strategy, design, promotion, and software to solve real commercial
                challenges.
              </p>
            </div>
            <div className="lg:col-span-5">
              <MediaFrame
                src="/src/assets/images/about_collaboration_workspace_1795243710209.jpg"
                alt="VERTYLEX strategists and designers reviewing business solution plans"
                aspectClass="aspect-[4/3]"
                className="rounded-lg"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <RevealSection className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {SOLUTION_TRACKS.map((track) => (
              <div
                key={track.index}
                className="grid grid-cols-1 gap-8 rounded-lg border border-[#E4E4E7] bg-white p-8 lg:grid-cols-12"
              >
                <div className="lg:col-span-6">
                  <p className="font-mono text-xs font-medium text-[#1D4ED8] tabular-nums">
                    Solution {track.index} · {track.stage}
                  </p>
                  <h2 className="mt-3 font-display text-2xl font-bold text-[#141416]">
                    {track.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-[#5A5A62]">{track.summary}</p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Link
                      to={`/submit-project?service=${encodeURIComponent(track.recommendedService)}`}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#141416] px-4 text-xs font-medium text-white hover:bg-[#1D4ED8] whitespace-nowrap"
                    >
                      Start This Track
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        openAssistant(`Tell me more about the "${track.title}" business solution.`)
                      }
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#E4E4E7] px-4 text-xs font-medium text-[#141416] hover:border-[#141416] whitespace-nowrap"
                    >
                      <Headphones className="h-3.5 w-3.5 text-[#1D4ED8]" aria-hidden="true" />
                      Ask VERTYLEX Assistant
                    </button>
                  </div>
                </div>

                <div className="border-t border-[#E4E4E7] pt-6 lg:col-span-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
                  <h3 className="text-xs font-semibold text-[#141416]">Typical Scope Included</h3>
                  <ul className="mt-4 space-y-3 text-sm text-[#5A5A62]">
                    {track.included.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <span
                          className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#1D4ED8]"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </RevealSection>
      </section>
    </div>
  );
}
