import PricingModal from '@/components/PricingModal';

// DEV-ONLY visual harness for the pricing modal (route registered only
// when import.meta.env.DEV — see App.tsx). The subscription promo Apply
// hits /api/validate-promo, which doesn't exist on the vite dev server,
// so only the placement code + summary + layout are testable here.
export default function DevPricingPreview() {
  return (
    <div className="min-h-screen bg-gray-200">
      <PricingModal open onOpenChange={() => {}} userId="dev-fixture" userEmail="dev@example.test" />
    </div>
  );
}
