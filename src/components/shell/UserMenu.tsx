import { Link, useNavigate } from "react-router-dom";
import { LogOut, ScanLine, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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

/** Derive up-to-two-letter initials from a name or, failing that, an email. */
function initialsFrom(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email ? email.split("@")[0] : "");
  if (!source) return "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * UserMenu — profile dropdown in the shell top bar. Bound to the real Supabase
 * auth (`@/contexts/AuthContext`). When signed out it degrades to a plain
 * "Sign in" button rather than an empty avatar.
 */
export function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link to="/auth/signin">Sign in</Link>
      </Button>
    );
  }

  const displayName = profile?.full_name || user.email || "Account";
  const initials = initialsFrom(profile?.full_name, user.email);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full outline-none ring-offset-2 ring-offset-[#050505] focus-visible:ring-2 focus-visible:ring-[#FF6600]/60 transition-transform active:scale-95"
          aria-label="Account menu"
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
          {user.email && (
            <span className="text-xs font-normal text-muted-foreground truncate">
              {user.email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/my-scans" className="cursor-pointer">
            <ScanLine className="mr-2 h-4 w-4" />
            My Scans
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Settings
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
