"use client";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type SignUpOptions = {
  data?: {
    full_name?: string;
  }
};

type CustomUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  authenticated_at?: string;
  isCustomAuth: true;
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
      console.log("📋 Fetching profile by auth_user_id:", authUserId);
      
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
      
      console.log("✅ Profile found:", prof ? "Yes" : "No");
      return prof || null;
    } catch (err) {
      console.error("❌ Profile fetch exception:", err);
      return null;
    }
  };

  const fetchProfileById = async (userId: string) => {
    try {
      console.log("📋 Fetching profile by id:", userId);
      
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
      
      console.log("✅ Profile found:", prof ? "Yes" : "No", prof);
      return prof || null;
    } catch (err) {
      console.error("❌ Profile fetch exception:", err);
      return null;
    }
  };

  const createProfile = async (authUserId: string, email: string, fullName?: string) => {
    try {
      console.log("📝 Creating new profile for:", email);
      
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
      
      console.log("✅ Profile created successfully");
      return newProfile;
    } catch (err) {
      console.error("❌ Profile creation exception:", err);
      throw err;
    }
  };

  useEffect(() => {
    if (initialized.current) {
      console.log("⏭️ Auth already initialized, skipping");
      return;
    }
    initialized.current = true;

    let mounted = true;

    const initAuth = async () => {
      try {
        console.log("🔐 Initializing auth...");
        
        const customSession = localStorage.getItem('user_session');
        const isAuthenticated = localStorage.getItem('is_authenticated');

        if (customSession && isAuthenticated === 'true') {
          try {
            const userData = JSON.parse(customSession);
            console.log('🔍 Found custom session for:', userData.email);
            
            const prof = await fetchProfileById(userData.id);
            
            if (prof && prof.status === 'active') {
              if (!mounted) return;
              
              const customUser: CustomUser = {
                ...userData,
                isCustomAuth: true
              };
              
              setUser(customUser);
              setProfile(prof);
              userRef.current = customUser;
              authTypeRef.current = 'custom';
              setLoading(false);
              
              console.log("✅ Custom auth session restored successfully");
              console.log("👤 User:", customUser);
              console.log("📋 Profile:", prof);
              return;
            } else {
              console.warn('⚠️ Custom session invalid or user inactive, clearing...');
              localStorage.removeItem('user_session');
              localStorage.removeItem('is_authenticated');
              authTypeRef.current = null;
            }
          } catch (err) {
            console.error('❌ Custom session parse error:', err);
            localStorage.removeItem('user_session');
            localStorage.removeItem('is_authenticated');
            authTypeRef.current = null;
          }
        }
        
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
          console.log("ℹ️ No session found");
          setUser(null);
          setProfile(null);
          userRef.current = null;
          authTypeRef.current = null;
        }
      } catch (err) {
        console.error("❌ Auth init error:", err);
      } finally {
        if (mounted) {
          console.log("✅ Auth initialization complete");
          console.log("🔐 Auth type:", authTypeRef.current);
          setLoading(false);
        }
      }
    };

    const initTimeout = setTimeout(() => {
      if (loading) {
        console.warn("⚠️ Auth init timeout, forcing complete");
        setLoading(false);
      }
    }, 5000);

    initAuth().finally(() => {
      clearTimeout(initTimeout);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔄 Supabase Auth event:", event);
        console.log("🔐 Current auth type:", authTypeRef.current);

        if (!mounted) return;

        if (authTypeRef.current === 'custom') {
          console.log("⏭️ Ignoring Supabase auth event - using custom auth");
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          if (userRef.current && userRef.current.id === session.user.id) {
            console.log("⏭️ User already signed in, skipping duplicate");
            return;
          }
          
          console.log("✅ User signed in (Supabase Auth)");
          setUser(session.user);
          userRef.current = session.user;
          authTypeRef.current = 'supabase';
          
          const prof = await fetchProfileByAuthId(session.user.id);
          if (mounted) {
            setProfile(prof);
          }
        } else if (event === 'SIGNED_OUT') {
          if (authTypeRef.current === 'supabase') {
            console.log("👋 User signed out (Supabase Auth)");
            setUser(null);
            setProfile(null);
            userRef.current = null;
            authTypeRef.current = null;
          } else {
            console.log("⏭️ Ignoring SIGNED_OUT - custom auth is active");
          }
        } else if (event === 'TOKEN_REFRESHED') {
          console.log("🔄 Token refreshed");
        } else if (event === 'USER_UPDATED') {
          console.log("👤 User updated");
          if (session?.user && authTypeRef.current === 'supabase') {
            setUser(session.user);
            userRef.current = session.user;
          }
        }
      }
    );

    return () => {
      console.log("🧹 Cleaning up AuthProvider");
      mounted = false;
      clearTimeout(initTimeout);
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log("🔑 Attempting sign in:", email);
    
    try {
      console.log("🔍 Trying custom authentication...");
      
      const { data: authData, error: customAuthError } = await supabase.rpc('authenticate_user', {
        p_email: email.trim(),
        p_password: password
      });

      if (!customAuthError && authData && authData.length > 0) {
        const authenticatedUser = authData[0];
        console.log("✅ Custom auth successful:", authenticatedUser.email);
        
        if (authenticatedUser.status !== 'active') {
          return { 
            data: null, 
            error: { message: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ Admin.' }
          };
        }

        const prof = await fetchProfileById(authenticatedUser.user_id);

        const userData: CustomUser = {
          id: authenticatedUser.user_id,
          email: authenticatedUser.email,
          full_name: authenticatedUser.full_name,
          role: authenticatedUser.role_name?.toUpperCase() || 'USER',
          status: authenticatedUser.status,
          authenticated_at: new Date().toISOString(),
          isCustomAuth: true
        };

        setUser(userData);
        setProfile(prof);
        userRef.current = userData;
        authTypeRef.current = 'custom';

        localStorage.setItem('user_session', JSON.stringify(userData));
        localStorage.setItem('is_authenticated', 'true');

        console.log("✅ Custom auth login complete");
        console.log("👤 User:", userData);
        console.log("📋 Profile:", prof);
        
        return { data: { user: userData, session: null }, error: null };
      }

      console.log("🔍 Trying Supabase Auth...");
      const result = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      });
      
      if (result.error) {
        console.error("❌ All sign in methods failed");
        return { data: null, error: { message: 'Email hoặc mật khẩu không chính xác' } };
      }
      
      console.log("✅ Supabase Auth successful");
      authTypeRef.current = 'supabase';
      return { data: result.data, error: null };
      
    } catch (err) {
      console.error("❌ Sign in exception:", err);
      return { 
        data: null, 
        error: { message: err instanceof Error ? err.message : "Có lỗi xảy ra" }
      };
    }
  };

  const signOut = async () => {
    console.log("👋 Signing out");
    console.log("🔐 Auth type:", authTypeRef.current);
    
    try {
      setUser(null);
      setProfile(null);
      userRef.current = null;
      
      localStorage.removeItem('user_session');
      localStorage.removeItem('is_authenticated');
      
      if (authTypeRef.current === 'supabase') {
        console.log("📤 Signing out from Supabase Auth");
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          console.error("❌ Supabase sign out error:", error);
        } else {
          console.log("✅ Supabase signed out successfully");
        }
      }
      
      authTypeRef.current = null;
      console.log("✅ Signed out successfully");
    } catch (err) {
      console.error("❌ Sign out exception:", err);
    }
  };

  const signUp = async (email: string, password: string, options?: SignUpOptions) => {
    try {
      console.log("📝 Signing up:", email);
      
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
        console.error("❌ Auth sign up error:", authError);
        return { data: null, error: authError };
      }

      if (!authData.user) {
        console.error("❌ No user returned from sign up");
        return { data: null, error: new Error("No user returned") };
      }

      console.log("✅ Auth user created:", authData.user.id);

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

      console.log("✅ Sign up complete");
      return { data: authData, error: null };
      
    } catch (err) {
      console.error("❌ Sign up exception:", err);
      return { 
        data: null, 
        error: err instanceof Error ? err : new Error("Unknown error") 
      };
    }
  };

  const updateProfile = async (data: any) => {
    if (!user) {
      console.error("❌ No authenticated user");
      return { error: new Error("No authenticated user") };
    }
    
    console.log("💾 Updating profile for user:", user.id);
    
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

      console.log("📦 Merged data for upsert:", mergedData);

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
        console.error("❌ Upsert error:", error);
        throw error;
      }

      console.log("✅ Profile updated successfully:", result);
      setProfile(result);
      
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
      console.error("❌ Update failed:", err);
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