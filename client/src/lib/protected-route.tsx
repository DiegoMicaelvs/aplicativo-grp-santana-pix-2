import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Check if user must change password and redirect if not already on change password page
  if (user.mustChangePassword && path !== "/change-password") {
    return (
      <Route path={path}>
        <Redirect to="/change-password" />
      </Route>
    );
  }

  // Restrict indicador_nivel_1 users to only allowed paths
  if (user.role === "indicador_nivel_1") {
    const allowedPaths = ["/new-referral", "/nova-indicacao", "/referrals", "/change-password"];
    
    if (!allowedPaths.includes(path)) {
      return (
        <Route path={path}>
          <Redirect to="/new-referral" />
        </Route>
      );
    }
  }

  return <Route path={path} component={Component} />;
}

export function AdminRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}

/**
 * Rota liberada por PERMISSÃO, não por papel.
 *
 * Admin entra sempre. Gerente e analista entram se o cadastro deles tiver
 * alguma das permissões exigidas — exatamente o que `requirePermissao` cobra no
 * servidor (server/routes.ts). As duas listas precisam andar juntas: liberar só
 * aqui abriria uma tela que o servidor recusa; liberar só lá esconderia uma
 * tela que o usuário pode usar.
 *
 * Este guard é conveniência de navegação, não a barreira de segurança — quem
 * decide continua sendo o servidor, a cada requisição.
 */
export function PermissionRoute({
  path,
  component: Component,
  permissions,
}: {
  path: string;
  component: () => React.JSX.Element;
  permissions: string[];
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  const doUsuario: string[] = (user as any)?.permissions ?? [];
  const liberado =
    user?.role === "admin" ||
    ((user?.role === "gerente" || user?.role === "analista") &&
      permissions.some((p) => doUsuario.includes(p)));

  if (!liberado) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}

export function PromoterRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user || (user.role !== "promotor" && user.role !== "admin")) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}

export function VendedorRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user || (user.role !== "vendedor" && user.role !== "admin")) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}

export function ManagerRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user || (user.role !== "gerente" && user.role !== "admin")) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}

export function AnalystRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user || (user.role !== "analista" && user.role !== "admin" && user.role !== "gerente")) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}

export function ReferralLinkRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  // Check if user has permission for referral links (admin, promoter, analyst level 3)
  const hasPermission = user && (
    user.role === "admin" || 
    user.role === "promotor" || 
    (user.role === "analista" && user.analystLevel === 3)
  );

  if (!hasPermission) {
    return (
      <Route path={path}>
        <Redirect to="/dashboard" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}

export function SupervisorRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user || (user.role !== "supervisor" && user.role !== "admin" && user.role !== "promotor")) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}

export function HomePageRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  // If user is indicador_nivel_1, redirect to new-referral page
  if (user && user.role === "indicador_nivel_1") {
    return (
      <Route path={path}>
        <Redirect to="/new-referral" />
      </Route>
    );
  }

  // For all other users (or no user), show the home page
  return <Route path={path} component={Component} />;
}
