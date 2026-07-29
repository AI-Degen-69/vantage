import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Index from "./pages/Index";
import Insights from "./pages/Insights";
import EarningsPage from "./pages/Earnings";
import ChartsPage from "./pages/Charts";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-screen bg-background dark">
    <Sidebar />
    <main className="flex-1 overflow-auto">{children}</main>
  </div>
);

const PlaceholderPage = () => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <h2 className="text-3xl font-bold text-foreground mb-4">Coming Soon</h2>
      <p className="text-muted-foreground mb-6">This page is currently under development.</p>
      <p className="text-sm text-slate-400">Check back soon for updates!</p>
    </div>
  </div>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                <AppLayout>
                  <Index />
                </AppLayout>
              }
            />
            <Route path="/stock/:ticker" element={<AppLayout><Index /></AppLayout>} />
            <Route path="/insights" element={<AppLayout><Insights /></AppLayout>} />
            <Route path="/watchlists" element={<AppLayout><PlaceholderPage /></AppLayout>} />
            <Route path="/charts" element={<AppLayout><ChartsPage /></AppLayout>} />
            <Route path="/earnings" element={<AppLayout><EarningsPage /></AppLayout>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
