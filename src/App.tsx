// src/App.tsx
import React, { Suspense } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Layouts
import { MainLayout } from "@/components/layout/MainLayout";

// Safe namespace imports to avoid "has no default export" / named vs default mismatches
import * as DashboardPageModule from "@/pages/DashboardPage";
import * as JobsPageModule from "@/pages/JobsPage";
import * as CandidatesPageModule from "@/pages/CandidatesPage";
import * as InterviewsPageModule from "@/pages/InterviewsPage";
import * as CVFilterPageModule from "@/pages/CV-filter-page";
import * as LoginPageModule from "@/pages/LoginPage";
import * as ReviewsPageModule from "@/pages/ReviewsPage";
import * as EmailManagementPageModule from "@/pages/EmailManagementPage";
import * as SettingsPageModule from "@/pages/SettingsPage";
import * as ProfileSettingsPageModule from "@/pages/ProfileSettingsPage";
import * as AIToolsPageModule from "@/pages/AI/AIToolsPage";
import * as OffersPageModule from "@/pages/OffersPage";
import * as CategorySettingsModule from "@/components/settings/CategorySettings";
import * as RegisterPageModule from "@/pages/RegisterPage";
import * as UsersPageModule from "@/pages/User";

// Helper to pick component from module: prefer default, fallback to named export with common names
function resolveModuleComponent<M extends Record<string, any>>(mod: M, names: string[]) {
  if (!mod) return null;
  if (mod.default) return mod.default as React.ComponentType<any>;
  for (const n of names) {
    if (mod[n]) return mod[n] as React.ComponentType<any>;
  }
  const keys = Object.keys(mod);
  for (const k of keys) {
    const candidate = mod[k];
    if (typeof candidate === "function" || typeof candidate === "object") return candidate as React.ComponentType<any>;
  }
  return null;
}

const DashboardPage = resolveModuleComponent(DashboardPageModule, ["DashboardPage"]) ?? (() => <div>Missing Dashboard</div>);
const JobsPage = resolveModuleComponent(JobsPageModule, ["JobsPage"]) ?? (() => <div>Missing Jobs</div>);
const CandidatesPage = resolveModuleComponent(CandidatesPageModule, ["CandidatesPage"]) ?? (() => <div>Missing Candidates</div>);
const InterviewsPage = resolveModuleComponent(InterviewsPageModule, ["InterviewsPage"]) ?? (() => <div>Missing Interviews</div>);
const CVFilterPage = resolveModuleComponent(CVFilterPageModule, ["CVFilterPage", "CVFilter"]) ?? (() => <div>Missing CV Filter</div>);
const LoginPage = resolveModuleComponent(LoginPageModule, ["LoginPage"]) ?? (() => <div>Missing Login</div>);
const ReviewsPage = resolveModuleComponent(ReviewsPageModule, ["ReviewsPage"]) ?? (() => <div>Missing Reviews</div>);
const EmailManagementPage = resolveModuleComponent(EmailManagementPageModule, ["EmailManagementPage"]) ?? (() => <div>Missing Email Management</div>);
const SettingsPage = resolveModuleComponent(SettingsPageModule, ["SettingsPage"]) ?? (() => <div>Missing Settings</div>);
const ProfileSettingsPage = resolveModuleComponent(ProfileSettingsPageModule, ["ProfileSettingsPage"]) ?? (() => <div>Missing Profile Settings</div>);
const AIToolsPage = resolveModuleComponent(AIToolsPageModule, ["AIToolsPage"]) ?? (() => <div>Missing AI Tools</div>);
const OffersPage = resolveModuleComponent(OffersPageModule, ["OffersPage"]) ?? (() => <div>Missing Offers</div>);
const CategorySettingsPage = resolveModuleComponent(CategorySettingsModule, ["CategorySettingsPage","CategorySettings"]) ?? (() => <div>Missing Category Settings</div>);
const RegisterPage = resolveModuleComponent(RegisterPageModule, ["RegisterPage"]) ?? (() => <div>Missing Register</div>);
const UsersPage = resolveModuleComponent(UsersPageModule, ["UsersPage","User"]) ?? (() => <div>Missing Users</div>);

const router = createBrowserRouter([
  // Public routes
  { 
    path: "/login", 
    element: <LoginPage /> 
  },
  { 
    path: "/register", 
    element: <RegisterPage /> 
  },
  
  // Protected routes with MainLayout
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      // Redirect root to dashboard
      { 
        index: true, 
        element: <Navigate to="/dashboard" replace /> 
      },
      
      // Routes accessible by ALL authenticated users
      { 
        path: "dashboard", 
        element: <DashboardPage /> 
      },
      { 
        path: "cai-dat/thong-tin-ca-nhan", 
        element: <ProfileSettingsPage /> 
      },
      { 
        path: "cai-dat", 
        element: <SettingsPage /> 
      },
      
      // Routes for HR, INTERVIEWER, and ADMIN
      { 
        path: "mo-ta-cong-viec", 
        element: (
          <ProtectedRoute requiredRole={['ADMIN', 'HR', 'INTERVIEWER']}>
            <JobsPage />
          </ProtectedRoute>
        )
      },
      { 
        path: "ung-vien", 
        element: (
          <ProtectedRoute requiredRole={['ADMIN', 'HR', 'INTERVIEWER']}>
            <CandidatesPage />
          </ProtectedRoute>
        )
      },
      { 
        path: "phong-van", 
        element: (
          <ProtectedRoute requiredRole={['ADMIN', 'HR', 'INTERVIEWER']}>
            <InterviewsPage />
          </ProtectedRoute>
        )
      },
      { 
        path: "loc-cv", 
        element: (
          <ProtectedRoute requiredRole={['ADMIN', 'HR', 'INTERVIEWER']}>
            <CVFilterPage />
          </ProtectedRoute>
        )
      },
      { 
        path: "danh-gia", 
        element: (
          <ProtectedRoute requiredRole={['ADMIN', 'HR', 'INTERVIEWER']}>
            <ReviewsPage />
          </ProtectedRoute>
        )
      },
      { 
        path: "offers", 
        element: (
          <ProtectedRoute requiredRole={['ADMIN', 'HR']}>
            <OffersPage />
          </ProtectedRoute>
        )
      },
      
      // Routes for ADMIN and HR only
      { 
        path: "nguoi-dung", 
        element: (
          <ProtectedRoute requiredRole={['ADMIN', 'HR']}>
            <UsersPage />
          </ProtectedRoute>
        )
      },
      { 
        path: "quan-ly-email", 
        element: (
          <ProtectedRoute requiredRole={['ADMIN', 'HR']}>
            <EmailManagementPage />
          </ProtectedRoute>
        )
      },
      { 
        path: "cai-dat/danh-muc", 
        element: (
          <ProtectedRoute requiredRole={['ADMIN', 'HR']}>
            <CategorySettingsPage />
          </ProtectedRoute>
        )
      },
      
      // Routes for ADMIN only
      { 
        path: "ai", 
        element: (
          <ProtectedRoute requiredRole="ADMIN">
            <AIToolsPage />
          </ProtectedRoute>
        )
      },
    ],
  },
  
  // Catch-all: redirect unknown routes to login
  { 
    path: "*", 
    element: <Navigate to="/login" replace /> 
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Đang tải...</p>
          </div>
        </div>
      }>
        <RouterProvider router={router} />
      </Suspense>
    </AuthProvider>
  );
}