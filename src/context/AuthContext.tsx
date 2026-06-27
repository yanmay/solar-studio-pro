import React, { createContext, useContext, useState, useEffect } from "react";

export type UserRole = "guest" | "homeowner" | "installer" | "admin";

export type Action =
  | "view_preview"
  | "unlock_prospectus"
  | "submit_lead"
  | "view_own_scans"
  | "view_assigned_leads"
  | "view_all_scans"
  | "view_all_leads"
  | "manage_users";

export interface User {
  id: string;
  email?: string;
  phone?: string;
  role: UserRole;
  companyName?: string;
}

export interface PermissionContext {
  ownerId?: string;
  currentUserId?: string;
  installerId?: string;
  leadInstallerId?: string;
}

export interface AuthContextType {
  user: User | null;
  role: UserRole;
  loginAs: (emailOrPhone: string, role: UserRole, extra?: Record<string, any>) => void;
  logout: () => void;
  can: (action: Action, context?: PermissionContext) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Single source-of-truth permission check function.
 */
export const can = (role: UserRole, action: Action, context?: PermissionContext): boolean => {
  if (role === "admin") {
    return true; // admin bypasses all checks
  }

  switch (action) {
    case "view_preview":
      return true;

    case "unlock_prospectus":
      if (role === "homeowner") {
        if (context?.ownerId && context?.currentUserId) {
          return context.ownerId === context.currentUserId;
        }
        return true;
      }
      return false;

    case "submit_lead":
      if (role === "homeowner") {
        if (context?.ownerId && context?.currentUserId) {
          return context.ownerId === context.currentUserId;
        }
        return true;
      }
      return false;

    case "view_own_scans":
      return role === "homeowner" || role === "installer";

    case "view_assigned_leads":
      if (role === "installer") {
        if (context?.installerId && context?.leadInstallerId) {
          return context.installerId === context.leadInstallerId;
        }
        return true;
      }
      return false;

    case "view_all_scans":
    case "view_all_leads":
    case "manage_users":
      return false; // only admin

    default:
      return false;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = sessionStorage.getItem("sunpower-auth-user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const loginAs = (emailOrPhone: string, role: UserRole, extra?: Record<string, any>) => {
    const isEmail = emailOrPhone.includes("@");
    const newUser: User = {
      id: extra?.id || `user_${Math.random().toString(36).substring(2, 9)}`,
      email: isEmail ? emailOrPhone : undefined,
      phone: !isEmail ? emailOrPhone : undefined,
      role,
      companyName: extra?.companyName,
    };
    setUser(newUser);
    sessionStorage.setItem("sunpower-auth-user", JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("sunpower-auth-user");
  };

  const userRole: UserRole = user?.role || "guest";

  const canWrapper = (action: Action, context?: PermissionContext): boolean => {
    return can(userRole, action, {
      currentUserId: user?.id,
      ...context,
    });
  };

  return (
    <AuthContext.Provider value={{ user, role: userRole, loginAs, logout, can: canWrapper }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
