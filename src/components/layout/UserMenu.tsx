// src/components/layout/UserMenu.tsx

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Settings, LogOut, ChevronUp } from 'lucide-react';

export const UserMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  // Đóng menu khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleProfileSettings = () => {
    navigate('/cai-dat/thong-tin-ca-nhan');
    setIsOpen(false);
  };

  // Lấy tên viết tắt từ profile hoặc user metadata
  const getInitials = () => {
    const fullName = profile?.full_name || user?.user_metadata?.full_name;
    if (fullName) {
      const names = fullName.split(' ').filter((n: string | any[]) => n.length > 0);
      return names.length > 1 
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : names[0][0].toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || 'A';
  };

  // CRITICAL: Get avatar from profile first, then fallback to user metadata
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin';
  const displayEmail = user?.email || 'admin@example.com';

  return (
    <div ref={menuRef} className="relative">
      {/* User Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors"
      >
        {/* Avatar with profile support */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm overflow-hidden ring-2 ring-white/20">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error('Avatar failed to load:', avatarUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            getInitials()
          )}
        </div>

        {/* User Info */}
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {displayName}
          </p>
          <p className="text-xs text-white/70 truncate">
            {displayEmail}
          </p>
        </div>

        {/* Chevron Icon */}
        <ChevronUp 
          className={`w-4 h-4 text-white/60 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <button
            onClick={handleProfileSettings}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Settings className="w-4 h-4 text-gray-500" />
            <span>Profile Settings</span>
          </button>

          <div className="border-t border-gray-200 my-1"></div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      )}
    </div>
  );
};