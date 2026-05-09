import { HeroSection } from '@/components/sections/HeroSection';
import { ProtocolOverviewSection } from '@/components/sections/ProtocolOverviewSection';
import { LineageGraphSection } from '@/components/sections/LineageGraphSection';
import { RoyaltySettlementSection } from '@/components/sections/RoyaltySettlementSection';
import { BuiltOn0GSection } from '@/components/sections/BuiltOn0GSection';
import { TestnetStatusSection } from '@/components/sections/TestnetStatusSection';
import { Footer } from '@/components/sections/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <HeroSection />
      <ProtocolOverviewSection />
      <LineageGraphSection />
      <RoyaltySettlementSection />
      <BuiltOn0GSection />
      <TestnetStatusSection />
      <Footer />
    </main>
  );
}
