// src/components/ProtectedRoute.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Shield } from "lucide-react";

type Props = {
  children: React.ReactNode;
  requiredRole?: string | string[]; // Keep for future use
};

export const ProtectedRoute: React.FC<Props> = ({ children, requiredRole }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Initial loading (auth initialization)
  if (loading) {
    console.log("⏳ Auth still loading...");
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  // If not logged in, redirect to login
  if (!user) {
    console.log("❌ No user found, redirecting to login");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log("✅ User authenticated:", user.email);
  console.log("📋 Profile:", profile);

  // ========================================
  // 🔓 ROLE CHECKING DISABLED TEMPORARILY
  // ========================================
  // Uncomment this section when you want to re-enable role-based access control
  
  /*
  // Get user role from profile or user object (for custom auth)
  let userRole: string | undefined;
  
  if ('isCustomAuth' in user && user.isCustomAuth) {
    // Custom auth user - role is in user object
    userRole = (user as any).role?.toUpperCase();
    console.log("🔐 Custom auth user role:", userRole);
  } else if (profile?.cv_user_roles?.[0]?.cv_roles?.name) {
    // Supabase auth user - role is in profile
    userRole = profile.cv_user_roles[0].cv_roles.name.toUpperCase();
    console.log("🔐 Supabase auth user role (from profile):", userRole);
  } else if (profile?.role) {
    // Fallback to direct role field
    userRole = profile.role.toUpperCase();
    console.log("🔐 User role (from profile.role):", userRole);
  }

  // Check role-based access if required
  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) 
      ? requiredRole.map(r => r.toUpperCase()) 
      : [requiredRole.toUpperCase()];

    console.log("🔐 Required role(s):", allowedRoles);
    console.log("🔐 User role:", userRole);

    if (!userRole || !allowedRoles.includes(userRole)) {
      console.log("❌ Access denied - insufficient permissions");
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-red-100 rounded-full">
                <Shield className="h-12 w-12 text-red-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Không có quyền truy cập
            </h1>
            <p className="text-gray-600 mb-2">
              Bạn không có quyền truy cập trang này.
            </p>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Vai trò của bạn:</strong>{" "}
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  {userRole || "Không xác định"}
                </span>
              </p>
              <p className="text-sm text-gray-700 mt-2">
                <strong>Vai trò yêu cầu:</strong>{" "}
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                  {Array.isArray(requiredRole) ? requiredRole.join(", ") : requiredRole}
                </span>
              </p>
            </div>
            <div className="mt-6 space-y-2">
              <button
                onClick={() => window.history.back()}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Quay lại
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      );
    }

    console.log("✅ Access granted - user has required role");
  }
  */

  // ========================================
  // ✅ SIMPLIFIED ACCESS CONTROL
  // ========================================
  // For now, just check if user is authenticated
  // All authenticated users can access all routes
  
  if (requiredRole) {
    console.log("ℹ️ Role checking is currently disabled");
    console.log("ℹ️ Required role:", requiredRole);
    console.log("ℹ️ Allowing access for authenticated user");
  }

  console.log("✅ Access granted - user is authenticated");
  return <>{children}</>;
};