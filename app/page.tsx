import Header from './components/homepage/Header';
import HeroSection from './components/homepage/HeroSection';
import CategoriesSection from './components/homepage/CategoriesSection';
import MarketingDiscountsSection from './components/homepage/MarketingDiscountsSection';
import HowItWorksSection from './components/homepage/HowItWorksSection';
import TopSuppliersSection from './components/homepage/TopSuppliersSection';
import RecentRFQSection from './components/homepage/RecentRFQSection';
import WhyBuyersSection from './components/homepage/WhyBuyersSection';
import SuppliersNetworkSection from './components/homepage/SuppliersNetworkSection';
import OfficialSuppliersSection from './components/homepage/OfficialSuppliersSection';
import ProcessSection from './components/homepage/ProcessSection';
import IndustrySolutionsSection from './components/homepage/IndustrySolutionsSection';
import NumbersSection from './components/homepage/NumbersSection';
import CustomerReviewsSection from './components/homepage/CustomerReviewsSection';
import BottomCTASection from './components/homepage/BottomCTASection';
import Footer from './components/homepage/Footer';
import { loadHomepageSectionVisibility } from '../lib/homepage/visibility';

export const metadata = {
  title: 'ElectroMarket - Global Marketplace for Electronic Components',
  description: 'Upload your BOM, get quotes from verified suppliers, and source components faster and smarter.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const sectionVisibility = await loadHomepageSectionVisibility();

  return (
    <main className="public-homepage-scope min-h-screen bg-[#f5f8fc] text-slate-950">
      <Header />
      {sectionVisibility.hero && <HeroSection />}
      {sectionVisibility.categories && <CategoriesSection />}
      {sectionVisibility.marketing_discounts && <MarketingDiscountsSection />}
      {sectionVisibility.how_it_works && <HowItWorksSection />}
      {sectionVisibility.industry_solutions && <IndustrySolutionsSection />}
      {sectionVisibility.top_verified_suppliers && <TopSuppliersSection />}
      {sectionVisibility.recent_rfq && <RecentRFQSection />}
      {sectionVisibility.why_buyers && <WhyBuyersSection />}
      {sectionVisibility.suppliers_network && <SuppliersNetworkSection />}
      {sectionVisibility.official_suppliers && <OfficialSuppliersSection />}
      {sectionVisibility.process && <ProcessSection />}
      {sectionVisibility.marketplace_numbers && <NumbersSection />}
      {sectionVisibility.customer_reviews && <CustomerReviewsSection />}
      {sectionVisibility.final_cta && <BottomCTASection />}
      <Footer />
    </main>
  );
}
