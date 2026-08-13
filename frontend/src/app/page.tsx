import CatalogNavbar from '@/components/catalog/CatalogNavbar';
import HeroSection   from '@/components/catalog/HeroSection';
import AreasGrid     from '@/components/catalog/AreasGrid';
import Footer        from '@/components/catalog/Footer';
import { FeaturedProducts } from '@/components/catalog/ProductCard';

export default function HomePage() {
  return (
    <>
      <CatalogNavbar />
      <main>
        <HeroSection />
        <AreasGrid />
        <FeaturedProducts />
      </main>
      <Footer />
    </>
  );
}
