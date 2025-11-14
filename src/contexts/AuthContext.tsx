"use client";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type SignUpOptions = {
  data?: {
    full_name?: string;
  }
};

// ✅ FIXED: Added user_metadata to CustomUser
type CustomUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  authenticated_at?: string;
  isCustomAuth: true;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
};

type AuthContextType = {
  user: User | CustomUser | null;
  profile: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  setProfile: (p: any) => void;
  signUp: (email: string, password: string, options?: SignUpOptions) => Promise<any>;
  updateProfile: (data: any) => Promise<any>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | CustomUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  const initialized = useRef(false);
  const userRef = useRef<User | CustomUser | null>(null);
  const authTypeRef = useRef<'custom' | 'supabase' | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchProfileByAuthId = async (authUserId: string) => {
    try {
      const { data: prof, error } = await supabase
        .from("cv_profiles")
        .select(`
          *,
          cv_user_roles (
            role_id,
            cv_roles (
              name
            )
          )
        `)
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      
      if (error) {
        console.error("❌ Profile fetch error:", error);
        return null;
      }
      
      return prof || null;
    } catch (err) {
      console.error("❌ Profile fetch exception:", err);
      return null;
    }
  };

  const fetchProfileById = async (userId: string) => {
    try {
      const { data: prof, error } = await supabase
        .from("cv_profiles")
        .select(`
          *,
          cv_user_roles (
            role_id,
            cv_roles (
              name
            )
          )
        `)
        .eq("id", userId)
        .maybeSingle();
      
      if (error) {
        console.error("❌ Profile fetch error:", error);
        return null;
      }
      
      return prof || null;
    } catch (err) {
      console.error("❌ Profile fetch exception:", err);
      return null;
    }
  };

  const createProfile = async (authUserId: string, email: string, fullName?: string) => {
    try {
      const { data: newProfile, error } = await supabase
        .from("cv_profiles")
        .insert([
          {
            auth_user_id: authUserId,
            email: email,
            full_name: fullName || '',
            role: 'candidate',
            status: 'active'
          }
        ])
        .select()
        .single();
      
      if (error) {
        console.error("❌ Profile creation error:", error);
        throw error;
      }
      
      return newProfile;
    } catch (err) {
      console.error("❌ Profile creation exception:", err);
      throw err;
    }
  };

  // ⚠️ CRITICAL FIX: Always clear session on init
  const clearCustomSession = () => {
    console.log("🧹 Clearing custom session");
    localStorage.removeItem('user_session');
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('session_timestamp');
  };

  useEffect(() => {
    if (initialized.current) {
      return;
    }
    initialized.current = true;

    let mounted = true;

    const initAuth = async () => {
      try {
        console.log("🔐 Initializing auth...");
        
        // ⚠️ CRITICAL FIX: Always clear custom session on app start
        // User MUST login every time - no auto-login
        clearCustomSession();
        
        // Check Supabase Auth session only
        console.log('🔍 Checking Supabase Auth session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("❌ Session error:", error);
        }
        
        if (!mounted) return;

        if (session?.user) {
          console.log("✅ Supabase session found:", session.user.email);
          setUser(session.user);
          userRef.current = session.user;
          authTypeRef.current = 'supabase';
          
          const prof = await fetchProfileByAuthId(session.user.id);
          if (mounted) {
            setProfile(prof);
          }
        } else {
          console.log("ℹ️ No valid session found - user must login");
          setUser(null);
          setProfile(null);
          userRef.current = null;
          authTypeRef.current = null;
        }
      } catch (err) {
        console.error("❌ Auth init error:", err);
        clearCustomSession();
      } finally {
        if (mounted) {
          console.log("✅ Auth initialization complete");
          setLoading(false);
        }
      }
    };

    const initTimeout = setTimeout(() => {
      if (loading) {
        console.warn("⚠️ Auth init timeout");
        setLoading(false);
      }
    }, 3000);

    initAuth().finally(() => {
      clearTimeout(initTimeout);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔄 Supabase Auth event:", event);

        if (!mounted) return;

        if (authTypeRef.current === 'custom') {
          console.log("⏭️ Ignoring Supabase auth event - using custom auth");
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          if (userRef.current && userRef.current.id === session.user.id) {
            return;
          }
          
          setUser(session.user);
          userRef.current = session.user;
          authTypeRef.current = 'supabase';
          
          const prof = await fetchProfileByAuthId(session.user.id);
          if (mounted) {
            setProfile(prof);
          }
        } else if (event === 'SIGNED_OUT') {
          if (authTypeRef.current === 'supabase') {
            setUser(null);
            setProfile(null);
            userRef.current = null;
            authTypeRef.current = null;
          }
        } else if (event === 'USER_UPDATED') {
          if (session?.user && authTypeRef.current === 'supabase') {
            setUser(session.user);
            userRef.current = session.user;
          }
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(initTimeout);
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log("🔑 Attempting sign in:", email);
    
    try {
      // ⚠️ TEMPORARY: Skip RPC completely, use Supabase Auth only
      console.log("🔍 Using Supabase Auth (RPC disabled)...");
      
      const result = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      });
      
      console.log("📥 Supabase Auth result:", result);
      
      if (result.error) {
        console.error("❌ Supabase Auth failed:", result.error);
        return { data: null, error: { message: 'Email hoặc mật khẩu không chính xác' } };
      }
      
      console.log("✅ Supabase Auth successful");
      authTypeRef.current = 'supabase';
      
      // ⚠️ CRITICAL FIX: Ensure profile exists for Supabase Auth users
      if (result.data.user) {
        console.log("🔍 Checking if profile exists...");
        let prof = await fetchProfileByAuthId(result.data.user.id);
        
        if (!prof) {
          console.log("📝 Profile not found, creating...");
          try {
            prof = await createProfile(
              result.data.user.id,
              result.data.user.email || '',
              result.data.user.user_metadata?.full_name
            );
            console.log("✅ Profile created:", prof);
          } catch (createError) {
            console.error("❌ Failed to create profile:", createError);
          }
        } else {
          console.log("✅ Profile exists:", prof);
        }
        
        // Set profile state
        setProfile(prof);
      }
      
      return { data: result.data, error: null };
      
    } catch (err) {
      console.error("❌ Sign in exception:", err);
      return { 
        data: null, 
        error: { message: "Có lỗi xảy ra khi đăng nhập. Vui lòng thử lại." }
      };
    }
  };

  const signOut = async () => {
    console.log("👋 Signing out");
    
    try {
      // Clear state first
      setUser(null);
      setProfile(null);
      userRef.current = null;
      
      // Clear all session data
      clearCustomSession();
      
      // Only sign out from Supabase if using Supabase auth
      if (authTypeRef.current === 'supabase') {
        console.log("📤 Signing out from Supabase Auth");
        await supabase.auth.signOut();
      }
      
      authTypeRef.current = null;
      console.log("✅ Signed out successfully");
    } catch (err) {
      console.error("❌ Sign out exception:", err);
      clearCustomSession();
    }
  };

  const signUp = async (email: string, password: string, options?: SignUpOptions) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: options?.data?.full_name || ''
          }
        }
      });

      if (authError) {
        return { data: null, error: authError };
      }

      if (!authData.user) {
        return { data: null, error: new Error("No user returned") };
      }

      let existingProfile = await fetchProfileByAuthId(authData.user.id);
      
      if (!existingProfile) {
        try {
          const newProfile = await createProfile(
            authData.user.id,
            email,
            options?.data?.full_name
          );
          existingProfile = newProfile;
        } catch (profileError) {
          console.error("❌ Profile creation failed:", profileError);
        }
      }

      setUser(authData.user);
      setProfile(existingProfile);
      userRef.current = authData.user;
      authTypeRef.current = 'supabase';

      return { data: authData, error: null };
      
    } catch (err) {
      return { 
        data: null, 
        error: err instanceof Error ? err : new Error("Unknown error") 
      };
    }
  };

  const updateProfile = async (data: any) => {
    if (!user) {
      return { error: new Error("No authenticated user") };
    }
    
    try {
      const isCustomAuthUser = 'isCustomAuth' in user && user.isCustomAuth;
      
      const mergedData = {
        ...(isCustomAuthUser ? { id: user.id } : { auth_user_id: user.id }),
        email: user.email || '',
        full_name: data.full_name !== undefined 
          ? data.full_name 
          : (profile?.full_name || ''),
        phone: data.phone !== undefined 
          ? data.phone 
          : (profile?.phone || ''),
        avatar_url: data.avatar_url !== undefined 
          ? data.avatar_url 
          : (profile?.avatar_url || ''),
        updated_at: new Date().toISOString()
      };

      const { data: result, error } = await supabase
        .from("cv_profiles")
        .upsert(
          mergedData,
          {
            onConflict: isCustomAuthUser ? 'id' : 'auth_user_id',
            ignoreDuplicates: false
          }
        )
        .select()
        .single();

      if (error) {
        throw error;
      }

      setProfile(result);
      
      // Update custom session if applicable
      if (isCustomAuthUser) {
        const currentSession = localStorage.getItem('user_session');
        if (currentSession) {
          const sessionData = JSON.parse(currentSession);
          const updatedSession = {
            ...sessionData,
            full_name: result.full_name
          };
          localStorage.setItem('user_session', JSON.stringify(updatedSession));
        }
      }
      
      return { data: result, error: null };
      
    } catch (err) {
      return { 
        data: null, 
        error: err instanceof Error ? err : new Error("Unknown error") 
      };
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        profile, 
        loading, 
        signIn, 
        signOut, 
        setProfile, 
        signUp, 
        updateProfile 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};