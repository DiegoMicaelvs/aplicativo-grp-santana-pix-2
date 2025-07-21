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
import AdminDashboard from "@/pages/admin-dashboard-new";
import AdminAnalysts from "@/pages/admin-analysts";
import AdminProfiles from "@/pages/admin-profiles";
import AdminAuditLog from "@/pages/admin-audit-log";
import AdminWithdrawals from "@/pages/admin-withdrawals";
import AdminIndicators from "@/pages/admin-indicators";
import AdminReferralsDetailed from "@/pages/admin-referrals-detailed";
import AdminPayments from "@/pages/admin-payments";
import AdminAnalytics from "@/pages/admin-analytics";
import AdminSupportTickets from "@/pages/admin-support-tickets";
import PromoterDashboard from "@/pages/promoter-dashboard";
import TeamDashboard from "@/pages/team-dashboard";
import { ProtectedRoute } from "./lib/protected-route";
import { AdminRoute, PromoterRoute } from "./lib/protected-route";
import { SupportButton } from "@/components/ui/support-button";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/dashboard" component={DashboardPage} />
      <ProtectedRoute path="/referrals" component={ReferralsPage} />
      <ProtectedRoute path="/new-referral" component={NewReferralPage} />
      <ProtectedRoute path="/nova-indicacao" component={NewReferralPage} />
      <ProtectedRoute path="/earnings" component={EarningsPage} />
      <AdminRoute path="/admin" component={AdminDashboard} />
      <AdminRoute path="/admin/analysts" component={AdminAnalysts} />
      <AdminRoute path="/admin/profiles" component={AdminProfiles} />
      <AdminRoute path="/admin/audit-log" component={AdminAuditLog} />
      <AdminRoute path="/admin/withdrawals" component={AdminWithdrawals} />
      <AdminRoute path="/admin/indicators" component={AdminIndicators} />
      <AdminRoute path="/admin/referrals-detailed" component={AdminReferralsDetailed} />
      <AdminRoute path="/admin/payments" component={AdminPayments} />
      <AdminRoute path="/admin/analytics" component={AdminAnalytics} />
      <AdminRoute path="/admin/support-tickets" component={AdminSupportTickets} />
      <PromoterRoute path="/promoter" component={PromoterDashboard} />
      <PromoterRoute path="/team" component={TeamDashboard} />
      <Route path="/team-dashboard" component={TeamDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <SupportButton />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
