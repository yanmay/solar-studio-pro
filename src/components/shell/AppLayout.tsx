import { Outlet } from "react-router-dom";
import { AppShell } from "./AppShell";
import { UserMenu } from "./UserMenu";
import { APP_NAV } from "@/lib/nav-registry";

/**
 * AppLayout — element for the app cluster's v6 layout route
 * (`/dashboard`, `/my-scans`, `/settings`, `/admin`). Wraps the matched child
 * route in the shared shell with the Supabase-app nav + real profile menu.
 */
export function AppLayout() {
  return (
    <AppShell nav={APP_NAV} profile={<UserMenu />}>
      <Outlet />
    </AppShell>
  );
}
