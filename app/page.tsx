import Header from './components/homepage/Header';
import HeroSection from './components/homepage/HeroSection';
import CategoriesSection from './components/homepage/CategoriesSection';
import HowItWorksSection from './components/homepage/HowItWorksSection';
import TopSuppliersSection from './components/homepage/TopSuppliersSection';
import RecentRFQSection from './components/homepage/RecentRFQSection';
import WhyBuyersSection from './components/homepage/WhyBuyersSection';
import SuppliersNetworkSection from './components/homepage/SuppliersNetworkSection';
import OfficialSuppliersSection from './components/homepage/OfficialSuppliersSection';
import ProcessSection from './components/homepage/ProcessSection';
import IndustrySolutionsSection from './components/homepage/IndustrySolutionsSection';
import CustomerReviewsSection from './components/homepage/CustomerReviewsSection';
import NumbersSection from './components/homepage/NumbersSection';
import BottomCTASection from './components/homepage/BottomCTASection';
import Footer from './components/homepage/Footer';

export const metadata = {
  title: 'ElectroMarket - Global Marketplace for Electronic Components',
  description: 'Upload your BOM, get quotes from verified suppliers, and source components faster and smarter.',
};

export default function HomePage() {
  return (
    <main>
      <Header />
      <HeroSection />
      <CategoriesSection />
      <HowItWorksSection />
      <TopSuppliersSection />
      <RecentRFQSection />
      <WhyBuyersSection />
      <SuppliersNetworkSection />
      <OfficialSuppliersSection />
      <ProcessSection />
      <IndustrySolutionsSection />
      <NumbersSection />
      <CustomerReviewsSection />
      <BottomCTASection />
      <Footer />
    </main>
  );
}
