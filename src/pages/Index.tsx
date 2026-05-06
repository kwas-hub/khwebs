import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ServicesSection from "@/components/ServicesSection";
import ProcessSection from "@/components/ProcessSection";
import ContactSection from "@/components/ContactSection";
import PublishedContent from "@/components/PublishedContent";
import BookingSection from "@/components/BookingSection";
import PublishedForms from "@/components/PublishedForms";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <ServicesSection />
      <ProcessSection />
      <PublishedContent />
      <BookingSection />
      <PublishedForms />
      <ContactSection />
      <Footer />
    </div>
  );
};

export default Index;
