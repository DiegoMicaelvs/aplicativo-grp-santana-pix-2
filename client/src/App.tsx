import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import SignupPage from "@/pages/signup-page";
import DashboardPage from "@/pages/dashboard-page";
import NewReferralPage from "@/pages/new-referral-page";
import ReferralsPage from "@/pages/referrals-page";
import EarningsPage from "@/pages/earnings-page";
import WithdrawalPage from "@/pages/withdrawal-page";
import ChangePasswordPage from "@/pages/change-password-page";
import AdminDashboard from "@/pages/admin-dashboard-new";
import AdminAnalysts from "@/pages/admin-analysts";
import AdminProfiles from "@/pages/admin-profiles";
import AdminAuditLog from "@/pages/admin-audit-log";
import AdminWithdrawals from "@/pages/admin-withdrawals";
import AdminIndicators from "@/pages/admin-indicators";
import AdminReferralsDetailed from "@/pages/admin-referrals-detailed";
import AdminUserDetails from "@/pages/admin-user-details";
import AdminPayments from "@/pages/admin-payments";
import AdminAnalytics from "@/pages/admin-analytics";
import AdminSupportTickets from "@/pages/admin-support-tickets";
import AdminCompanies from "@/pages/admin-companies";
import AdminSettings from "@/pages/admin-settings";
import CompanyDashboard from "@/pages/company-dashboard";
import PublicCompanyDashboard from "@/pages/public-company-dashboard";
import PromoterDashboard from "@/pages/promoter-dashboard";
import SupervisorDashboard from "@/pages/supervisor-dashboard";
import TeamDashboard from "@/pages/team-dashboard";
import VendedorDashboard from "@/pages/vendedor-dashboard";
import RegisterIndicator from "@/pages/register-indicator";
import SobrePage from "@/pages/sobre-page";
import ContatoPage from "@/pages/contato-page";
import ManagerDashboard from "@/pages/manager-dashboard";
import AnalystDashboard from "@/pages/analyst-dashboard";
import AnalystCreateIndicador from "@/pages/analyst-create-indicador";
import AnalystCreatePromotor from "@/pages/analyst-create-promotor";
import AnalystPermissions from "@/pages/analyst-permissions";
import AnalystReferrals from "@/pages/analyst-referrals";
import AnalystUsers from "@/pages/analyst-users";
import AnalystAnalytics from "@/pages/analyst-analytics";
import PlateSearchPage from "@/pages/plate-search";
import { ReferralLinksPage } from "@/pages/referral-links-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AdminRoute, PermissionRoute, PromoterRoute, SupervisorRoute, VendedorRoute, ManagerRoute, AnalystRoute, ReferralLinkRoute, HomePageRoute } from "./lib/protected-route";
import { SupportButton } from "@/components/ui/support-button";

function Router() {
  return (
    <Switch>
      <HomePageRoute path="/" component={HomePage} />
      <Route path="/sobre" component={SobrePage} />
      <Route path="/contato" component={ContatoPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/public-dashboard/:tokenOrId" component={PublicCompanyDashboard} />
      <ProtectedRoute path="/dashboard" component={DashboardPage} />
      <ProtectedRoute path="/referrals" component={ReferralsPage} />
      <ProtectedRoute path="/new-referral" component={NewReferralPage} />
      <ProtectedRoute path="/nova-indicacao" component={NewReferralPage} />
      <ProtectedRoute path="/earnings" component={EarningsPage} />
      <ProtectedRoute path="/withdrawals" component={WithdrawalPage} />
      <ProtectedRoute path="/saques" component={WithdrawalPage} />
      <ProtectedRoute path="/change-password" component={ChangePasswordPage} />
      <ProtectedRoute path="/plate-search" component={PlateSearchPage} />
      <ReferralLinkRoute path="/referral-links" component={ReferralLinksPage} />
      <AdminRoute path="/admin" component={AdminDashboard} />
      {/*
        Telas administrativas que o GERENTE também usa: liberadas por permissão,
        com a mesma lista que o servidor exige em requirePermissao. As demais
        seguem restritas ao admin.
      */}
      <PermissionRoute path="/admin/analysts" component={AdminAnalysts} permissions={["manage_analysts"]} />
      <PermissionRoute path="/admin/profiles" component={AdminProfiles} permissions={["view_all_users", "manage_all_users"]} />
      <PermissionRoute path="/admin/audit-log" component={AdminAuditLog} permissions={["audit_access"]} />
      <PermissionRoute path="/admin/withdrawals" component={AdminWithdrawals} permissions={["manage_withdrawals", "view_financial_reports"]} />
      <PermissionRoute path="/admin/indicators" component={AdminIndicators} permissions={["manage_promoters", "view_all_users"]} />
      <PermissionRoute path="/admin/referrals-detailed" component={AdminReferralsDetailed} permissions={["view_all_referrals", "edit_all_referrals"]} />
      <PermissionRoute path="/admin/analytics" component={AdminAnalytics} permissions={["view_all_reports", "view_financial_reports"]} />
      <AdminRoute path="/admin/user-details/:id" component={AdminUserDetails} />
      <AdminRoute path="/admin/payments" component={AdminPayments} />
      <AdminRoute path="/admin/support-tickets" component={AdminSupportTickets} />
      <AdminRoute path="/admin/companies" component={AdminCompanies} />
      <AdminRoute path="/admin/company-dashboard" component={CompanyDashboard} />
      {/*
        A rota /company-dashboard existia SEM guarda nenhuma: qualquer visitante
        anônimo abria o painel interno da empresa. A API barrava os dados, mas a
        tela aparecia. Quem é admin usa /admin/company-dashboard; a empresa
        parceira usa /public-dashboard/:token, que foi feito para isso.
      */}
      <AdminRoute path="/admin/settings" component={AdminSettings} />
      <PromoterRoute path="/promoter" component={PromoterDashboard} />
      <PromoterRoute path="/promoter-dashboard" component={PromoterDashboard} />
      <SupervisorRoute path="/supervisor-dashboard" component={SupervisorDashboard} />
      <PromoterRoute path="/register-indicator" component={RegisterIndicator} />
      <PromoterRoute path="/team" component={TeamDashboard} />
      <VendedorRoute path="/vendedor" component={VendedorDashboard} />
      <ManagerRoute path="/manager" component={ManagerDashboard} />
      <AnalystRoute path="/analyst" component={AnalystDashboard} />
      <AnalystRoute path="/analyst/create-indicador" component={AnalystCreateIndicador} />
      <AnalystRoute path="/analyst/create-promotor" component={AnalystCreatePromotor} />
      <AnalystRoute path="/analyst/permissions" component={AnalystPermissions} />
      <AnalystRoute path="/analyst/referrals" component={AnalystReferrals} />
      <AnalystRoute path="/analyst/users" component={AnalystUsers} />
      <AnalystRoute path="/analyst/analytics" component={AnalystAnalytics} />
      <ProtectedRoute path="/team-dashboard" component={TeamDashboard} />
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
