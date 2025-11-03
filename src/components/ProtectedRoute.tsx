// src/components/ProtectedRoute.tsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  children: React.ReactNode;
  requiredRole?: string; // optional
};

export const ProtectedRoute: React.FC<Props> = ({ children, requiredRole }) => {
  const { user, profile, loading } = useAuth();

  // initial loading (auth init)
  if (loading) return <div className="p-6">Loading...</div>;

  // if not logged in
  if (!user) return <Navigate to="/login" replace />;

  // if profile still loading (profile === undefined) show spinner
  if (profile === undefined) return <div className="p-6">Loading profile...</div>;

  // if required role specified, check it
  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
