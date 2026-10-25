import { Dialog, DialogContent } from '@/components/ui/dialog';
import AnonymousCandidateCard from '@/components/AnonymousCandidateCard';

// DEV-ONLY visual harness: renders the recruiter browse modal with fixture
// data so card/tooltip changes can be eyeballed on localhost without an
// account. The route is registered only when import.meta.env.DEV is true
// (see App.tsx) — it does not exist in production builds.

const FIXTURE = {
  id: 'dev-fixture',
  display_name: 'Finance Professional F-42',
  label: 'Manager, Financial Reporting',
  location: 'Los Angeles, CA',
  experience: 10,
  education: 'Masters Accounting',
  highest_education_level: 'Masters',
  profile_description:
    'A CPA with over a decade of experience spanning public accounting, deal advisory, and senior financial reporting roles. Specializes in technical accounting, financial consolidations, SEC reporting, and M&A integrations across technology, media, healthcare, and entertainment sectors. Proven ability to automate reporting processes.',
  primary_background: 'Accounting & Compliance',
  secondary_backgrounds: ['FP&A & Corporate Finance'],
  open_to_opportunities: true,
  skills: [
    { id: '1', skill: 'ERP Systems' },
    { id: '2', skill: 'SOX Compliance' },
    { id: '3', skill: 'NetSuite' },
    { id: '4', skill: 'Excel' },
  ],
  areas_of_expertise: ['Financial Reporting', 'Corporate Development', 'Strategic Planning', 'Technical Accounting'],
  detailed_experience: null,
  industries: ['Fintech', 'Consulting'],
  company_stage_experience: ['Series B', 'Series C+'],
  is_sfc_alum: true,
};

const FIXTURE_TAKE = {
  take:
    'This candidate is a strong technical accountant who is not yet a strategic finance operator, and recruiters should read the profile that way. Ten years run from audit to deal advisory, then four operating companies in reporting and consolidation seats. The diligence work is partial Path A signal (analytical pedigree from deal work), but it is not banking. The operating years are real but not Path B (strategic finance inside an operating company), because they were spent closing books and filing with the SEC, not forecasting or partnering with operators.\n\nWhat makes them interesting is the bridge: M&A seen end to end, a large carve-out, and a consolidation they automated that now feeds FP&A reporting. Best fit is an acquisitive or IPO-track company where deal mechanics and reporting rigor matter as much as the model.',
};

export default function DevCardPreview() {
  return (
    <div className="min-h-screen bg-gray-200 p-6">
      <p className="text-sm text-gray-600 mb-2">DEV harness — recruiter browse modal with fixture data (not in prod builds).</p>
      <Dialog open onOpenChange={() => {}}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
          <AnonymousCandidateCard
            candidate={FIXTURE as never}
            mode="recruiter"
            sfcTake={FIXTURE_TAKE}
            isAdmin={false}
            introCtaDisabled={false}
            introCtaLabel="Request Introduction"
            showSubscribeHint={false}
            onRequestIntro={() => {}}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
