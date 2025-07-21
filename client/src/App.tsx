import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import NewReferralPage from "@/pages/new-referral-page";
import ReferralsPage from "@/pages/referrals-page";
import EarningsPage from "@/pages/earnings-page";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminAnalysts from "@/pages/admin-analysts";
import AdminProfiles from "@/pages/admin-profiles";
import PromoterDashboard from "@/pages/promoter-dashboard";
import { ProtectedRoute } from "./lib/protected-route";
import { AdminRoute, PromoterRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/dashboard" component={DashboardPage} />
      <ProtectedRoute path="/referrals" component={ReferralsPage} />
      <ProtectedRoute path="/new-referral" component={NewReferralPage} />
      <ProtectedRoute path="/earnings" component={EarningsPage} />
      <AdminRoute path="/admin" component={AdminDashboard} />
      <AdminRoute path="/admin/analysts" component={AdminAnalysts} />
      <AdminRoute path="/admin/profiles" component={AdminProfiles} />
      <PromoterRoute path="/promoter" component={PromoterDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
