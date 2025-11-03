"use client";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type SignUpOptions = {
  data?: {
    full_name?: string;
  }
};

type AuthContextType = {
  user: User | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Prevent double initialization
  const initialized = useRef(false);
  
  // Keep track of current user to prevent duplicate updates on tab focus
  const userRef = useRef<User | null>(null);

  // Update ref whenever user changes
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Helper function to fetch profile by auth_user_id
  const fetchProfile = async (authUserId: string) => {
    try {
      console.log("📋 Fetching user profile for auth_user_id:", authUserId);
      
      const { data: prof, error } = await supabase
        .from("cv_profiles")
        .select("*")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      
      if (error) {
        console.error("❌ Profile fetch error:", error);
        return null;
      }
      
      console.log("✅ User profile:", prof ? "Found" : "Not found");
      return prof || null;
    } catch (err) {
      console.error("❌ Profile fetch exception:", err);
      return null;
    }
  };

  // Helper function to create profile
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
    // Run only once - prevent double initialization
    if (initialized.current) {
      console.log("⏭️ Auth already initialized, skipping");
      return;
    }
    initialized.current = true;

    let mounted = true;

    const initAuth = async () => {
      try {
        console.log("🔐 Initializing auth...");
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("❌ Session error:", error);
        }
        
        if (!mounted) return;

        if (session?.user) {
          console.log("✅ Session found:", session.user.email);
          setUser(session.user);
          userRef.current = session.user;
          
          // Fetch user's profile
          const prof = await fetchProfile(session.user.id);
          if (mounted) {
            setProfile(prof);
          }
        } else {
          console.log("ℹ️ No session found");
          setUser(null);
          setProfile(null);
          userRef.current = null;
        }
      } catch (err) {
        console.error("❌ Auth init error:", err);
      } finally {
        if (mounted) {
          console.log("✅ Auth initialization complete");
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔄 Auth event:", event);

        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          // Prevent duplicate updates when tab becomes active
          if (userRef.current && userRef.current.id === session.user.id) {
            console.log("⏭️ User already signed in, skipping duplicate SIGNED_IN event");
            return;
          }
          
          console.log("✅ User signed in (new or different user)");
          setUser(session.user);
          userRef.current = session.user;
          
          const prof = await fetchProfile(session.user.id);
          if (mounted) {
            setProfile(prof);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log("👋 User signed out");
          setUser(null);
          setProfile(null);
          userRef.current = null;
        } else if (event === 'TOKEN_REFRESHED') {
          console.log("🔄 Token refreshed (no state update needed)");
        } else if (event === 'USER_UPDATED') {
          console.log("👤 User updated");
          if (session?.user) {
            setUser(session.user);
            userRef.current = session.user;
          }
        }
      }
    );

    return () => {
      console.log("🧹 Cleaning up AuthProvider");
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log("🔑 Signing in:", email);
    
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      
      if (result.error) {
        console.error("❌ Sign in error:", result.error);
        return { data: null, error: result.error };
      }
      
      console.log("✅ Sign in successful");
      return { data: result.data, error: null };
    } catch (err) {
      console.error("❌ Sign in exception:", err);
      return { 
        data: null, 
        error: err instanceof Error ? err : new Error("Unknown error") 
      };
    }
  };

  const signOut = async () => {
    console.log("👋 Signing out");
    
    try {
      setUser(null);
      setProfile(null);
      userRef.current = null;
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("❌ Sign out error:", error);
      } else {
        console.log("✅ Signed out successfully");
      }
    } catch (err) {
      console.error("❌ Sign out exception:", err);
      setUser(null);
      setProfile(null);
      userRef.current = null;
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

      let existingProfile = await fetchProfile(authData.user.id);
      
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

  // CRITICAL FIX: Update profile with proper data merging
  const updateProfile = async (data: any) => {
    if (!user) {
      console.error("❌ No authenticated user");
      return { error: new Error("No authenticated user") };
    }
    
    console.log("💾 Updating profile for user:", user.id);
    console.log("📦 Update payload:", data);
    console.log("📦 Current profile:", profile);
    
    try {
      // CRITICAL: Merge with existing profile data to avoid null constraint violations
      const mergedData = {
        auth_user_id: user.id,
        email: user.email || '',
        full_name: data.full_name !== undefined 
          ? data.full_name 
          : (profile?.full_name || user.user_metadata?.full_name || ''),
        phone: data.phone !== undefined 
          ? data.phone 
          : (profile?.phone || ''),
        avatar_url: data.avatar_url !== undefined 
          ? data.avatar_url 
          : (profile?.avatar_url || ''),
        updated_at: new Date().toISOString()
      };

      console.log("📦 Merged data for upsert:", mergedData);

      // Use upsert to handle both insert and update
      const { data: result, error } = await supabase
        .from("cv_profiles")
        .upsert(
          mergedData,
          {
            onConflict: 'auth_user_id',
            ignoreDuplicates: false
          }
        )
        .select()
        .single();

      if (error) {
        console.error("❌ Upsert error:", error);
        throw error;
      }

      console.log("✅ Profile updated/created successfully:", result);
      setProfile(result);
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