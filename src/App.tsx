
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Home from "./pages/Home";
import SignUp from "./pages/SignUp";
import SignUpPending from "./pages/SignUpPending";
import SignUpRejected from "./pages/SignUpRejected";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPasswordProfessional from "./pages/ResetPasswordProfessional";
import ResetPasswordRecruiter from "./pages/ResetPasswordRecruiter";
import Dashboard from "./pages/Dashboard";
import CandidateSearch from "./pages/CandidateSearch";
import Account from "./pages/Account";
import Jobs from "./pages/Jobs";
import Favorites from "./pages/Favorites";
import Admin from "./pages/Admin";
import IntroductionRequests from "./pages/IntroductionRequests";
import StartHere from "./pages/StartHere";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import CandidateApply from "./pages/CandidateApply";
import CandidateDashboard from "./pages/CandidateDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/signup/pending" element={<SignUpPending />} />
            <Route path="/signup/rejected" element={<SignUpRejected />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPasswordProfessional />} />
            <Route path="/recruiter/reset-password" element={<ResetPasswordRecruiter />} />
            <Route path="/apply" element={<CandidateApply />} />
            <Route path="/candidate-dashboard" element={<CandidateDashboard />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route path="start-here" element={<StartHere />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="browse" element={<CandidateSearch />} />
              <Route path="account" element={<Account />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="introductions" element={<IntroductionRequests />} />
              <Route path="favorites" element={<Favorites />} />
              <Route path="admin" element={
                <ProtectedRoute requireAdmin>
                  <Admin />
                </ProtectedRoute>
              } />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
