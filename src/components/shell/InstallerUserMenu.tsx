import { Link, useNavigate } from "react-router-dom";
import { LogOut, Zap, Building2 } from "lucide-react";
import { useInstallerAuth } from "@/hooks/use-installer-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Derive up-to-two-letter initials from a company name or, failing that, an email. */
function initialsFrom(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email ? email.split("@")[0] : "");
  if (!source) return "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * InstallerUserMenu — profile dropdown in the installer shell top bar. Bound to
 * the installer's own localStorage-backed auth (`useInstallerAuth`), kept
 * deliberately separate from the Supabase `UserMenu`. Signed out, it degrades
 * to a "Register" button rather than an empty avatar.
 */
export function InstallerUserMenu() {
  const { profile, signOut } = useInstallerAuth();
  const navigate = useNavigate();

  if (!profile) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link to="/installer/signup">Register</Link>
      </Button>
    );
  }

  const displayName = profile.companyName || profile.email || "Partner";
  const initials = initialsFrom(profile.companyName, profile.email);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full outline-none ring-offset-2 ring-offset-[#050505] focus-visible:ring-2 focus-visible:ring-[#FF6600]/60 transition-transform active:scale-95"
          aria-label="Partner account menu"
        >
          <Avatar className="h-8 w-8 border border-white/10">
            <AvatarFallback className="bg-[#FF6600]/15 text-[#FF6600] text-[11px] font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground truncate">
            {displayName}
          </span>
          <span className="text-xs font-normal text-muted-foreground truncate flex items-center gap-1">
            <Building2 className="h-3 w-3 text-[#FF6600]" />
            {profile.city || "—"}, {profile.state || "—"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/map" className="cursor-pointer">
            <Zap className="mr-2 h-4 w-4" />
            Run Rooftop Scan
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-red-400 focus:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
