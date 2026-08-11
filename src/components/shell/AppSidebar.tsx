import { Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { NavGroup } from "@/lib/nav-registry";

interface AppSidebarProps {
  /** Nav groups to render (APP_NAV or INSTALLER_NAV). */
  nav: NavGroup[];
  /** Optional footer content (e.g. installer profile summary). */
  footer?: React.ReactNode;
}

/**
 * AppSidebar — brand rail for the app shell. Reads active state from the router
 * so the current page's item is highlighted, and collapses to an icon rail
 * (the parent <Sidebar collapsible="icon"> hides labels via CSS).
 */
export function AppSidebar({ nav, footer }: AppSidebarProps) {
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-white/[0.06]">
      <SidebarHeader className="border-b border-white/[0.06]">
        <Link
          to="/"
          className="flex items-center gap-2.5 px-1.5 py-1.5 group"
          aria-label="SUNPOWER LINK Home"
        >
          <img
            src="/logo.png"
            alt=""
            className="w-8 h-8 shrink-0 object-contain transition-transform duration-200 group-hover:scale-105"
          />
          <span className="text-[15px] font-bold text-white tracking-tight whitespace-nowrap group-data-[collapsible=icon]:hidden">
            SUNPOWER{" "}
            <span className="font-['Calistoga',serif] italic font-normal text-[#FF6600]">
              LINK
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {nav.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.path ||
                    pathname.startsWith(`${item.path}/`);
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <Link to={item.path}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {footer && (
        <SidebarFooter className="border-t border-white/[0.06]">
          {footer}
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
