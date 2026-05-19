import { Search, Handshake, CalendarCheck, BadgeCheck, ShieldCheck, ArrowRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const steps = [
  {
    icon: Search,
    title: 'Browse Anonymous Talent',
    description: 'Explore our curated pool of pre-screened strategic finance professionals. All profiles are anonymous to protect candidate privacy until an introduction is made.',
  },
  {
    icon: Handshake,
    title: 'Request an Introduction',
    description: "Found someone interesting? Submit an introduction request and tell us about the role you're hiring for. We review every request personally.",
  },
  {
    icon: Clock,
    title: 'We Move Fast',
    description: "Expect a response within 24 hours. Once approved, we'll reach out to the candidate on your behalf and confirm their interest.",
  },
  {
    icon: CalendarCheck,
    title: 'Book a Meeting',
    description: "When the candidate is ready, you'll receive a scheduling link to book a call directly. No back and forth, no guesswork.",
  },
  {
    icon: BadgeCheck,
    title: 'Hire with Confidence',
    description: "Every SFC candidate has been vetted through our academy and career program. You're not browsing a database — you're accessing a talent network.",
  },
];

const StartHere = () => {
  return (
    <div className="min-h-full bg-white px-6 py-12">
      <div className="max-w-5xl mx-auto">

        {/* Hero */}
        <div className="text-center mb-14">
          <span className="inline-block mb-4 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full uppercase">
            Welcome to SFC Talent
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            Find Exceptional Finance Talent, Fast
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            We've built a smarter way to hire. Here's everything you need to know before you start.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={i}
                className="relative flex flex-col p-5 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-3">
                  {i + 1}
                </span>
                <Icon className="h-5 w-5 text-gray-400 mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            );
          })}
        </div>

        {/* Privacy Info Box */}
        <div className="flex items-start gap-4 p-6 bg-emerald-50 border border-emerald-200 rounded-xl mb-12">
          <ShieldCheck className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Privacy First</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Candidate identities are never revealed without mutual consent. Real names, contact details, and employers are only shared after an introduction is approved by our team.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-base text-gray-500 mb-4">Ready to find your next hire?</p>
          <Link
            to="/browse"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors duration-200"
          >
            Browse Candidates
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

      </div>
    </div>
  );
};

export default StartHere;
