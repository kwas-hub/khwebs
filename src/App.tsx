import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import Index from "./pages/Index";
import Impressum from "./pages/Impressum";
import Datenschutz from "./pages/Datenschutz";
import Auth from "./pages/Auth";
import Dashboard from "./pages/admin/Dashboard";
import News from "./pages/admin/News";
import Termine from "./pages/admin/Termine";
import Formulare from "./pages/admin/Formulare";
import Users from "./pages/admin/Users";
import AI from "./pages/admin/AI";
import Tenants from "./pages/admin/Tenants";
import ApiSettings from "./pages/admin/ApiSettings";
import SubmissionDetail from "./pages/admin/SubmissionDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/impressum" element={<Impressum />} />
              <Route path="/datenschutz" element={<Datenschutz />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/news" element={<News />} />
              <Route path="/admin/termine" element={<Termine />} />
              <Route path="/admin/formulare" element={<Formulare />} />
              <Route path="/admin/formulare/:submissionId" element={<SubmissionDetail />} />
              <Route path="/admin/users" element={<Users />} />
              <Route path="/admin/ai" element={<AI />} />
              <Route path="/admin/tenants" element={<Tenants />} />
              <Route path="/admin/api-settings" element={<ApiSettings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
