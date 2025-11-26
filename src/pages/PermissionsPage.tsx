// src/pages/PermissionsPage.tsx - OPTIMIZED VERSION
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Shield,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Info,
  TrendingUp,
  Loader2
} from "lucide-react"

// ========================================
// TYPE DEFINITIONS
// ========================================
type Role = {
  roles: number  // Primary key column name in cv_roles
  name: string
  description: string
  color: string
  icon: string
}

type Permission = {
  id: number
  module: string
  action: string
  name: string
  description: string
}

type PermissionMatrix = {
  [roleId: number]: {
    [permissionId: number]: boolean
  }
}

type PermissionStats = {
  role_id: number
  role_name: string
  total_modules: number
  total_permissions: number
  viewable_modules: number
  create_permissions: number
  update_permissions: number
  delete_permissions: number
}

type MatrixItem = {
  role_id: number
  permission_id: number
  has_permission: boolean
}

// ========================================
// CONSTANTS
// ========================================
const ADMIN_ROLE_ID = 1 // Admin role cannot be modified

const MODULE_METADATA: Record<string, { label: string; icon: string }> = {
  dashboard: { label: "Dashboard", icon: "📊" },
  jobs: { label: "Công việc", icon: "💼" },
  candidates: { label: "Ứng viên", icon: "👥" },
  interviews: { label: "Phỏng vấn", icon: "📅" },
  cv_filter: { label: "Lọc CV", icon: "🔍" },
  reviews: { label: "Đánh giá", icon: "⭐" },
  offers: { label: "Offer", icon: "📄" },
  email: { label: "Email", icon: "📧" },
  users: { label: "Người dùng", icon: "👤" },
  permissions: { label: "Phân quyền", icon: "🔐" },
  settings: { label: "Cài đặt", icon: "⚙️" },
  ai_tools: { label: "AI Tools", icon: "🤖" },
}

const ACTION_LABELS: Record<string, string> = {
  view: "Xem",
  create: "Tạo",
  update: "Sửa",
  delete: "Xóa",
}

// ========================================
// CUSTOM TOGGLE SWITCH COMPONENT
// ========================================
const ToggleSwitch = ({ 
  checked, 
  onChange,
  disabled = false,
  ariaLabel
}: { 
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  ariaLabel?: string
}) => {
  return (
    <label className={`toggle-switch ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <input 
        type="checkbox" 
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        aria-label={ariaLabel}
        role="switch"
        aria-checked={checked}
      />
      <span className="toggle-slider small"></span>
      <style>{`
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: .3s;
          border-radius: 20px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .3s;
          border-radius: 50%;
        }

        input:checked + .toggle-slider {
          background-color: #2563eb;
        }

        input:disabled + .toggle-slider {
          cursor: not-allowed;
        }

        input:checked + .toggle-slider:before {
          transform: translateX(16px);
        }
      `}</style>
    </label>
  )
}

// ========================================
// MAIN COMPONENT
// ========================================
export default function PermissionsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "matrix">("overview")
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix>({})
  const [stats, setStats] = useState<PermissionStats[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pendingChanges, setPendingChanges] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  // ========================================
  // DATA LOADING
  // ========================================
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Loading permissions data...')
      }

      // Load roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('cv_roles')
        .select('*')
        .order('roles', { ascending: true })

      if (rolesError) {
        console.error('❌ Roles error:', rolesError)
        if (rolesError.code === 'PGRST116') {
          throw new Error('Bảng cv_roles không tồn tại. Vui lòng chạy migrations.')
        }
        throw new Error(`Lỗi load roles: ${rolesError.message}`)
      }

      // Load permissions
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('cv_permissions')
        .select('*')
        .order('module, action')

      if (permissionsError) {
        console.error('❌ Permissions error:', permissionsError)
        if (permissionsError.code === 'PGRST116') {
          throw new Error('Bảng cv_permissions không tồn tại. Vui lòng chạy migrations.')
        }
        throw new Error(`Lỗi load permissions: ${permissionsError.message}`)
      }

      // Load permission matrix
      const { data: matrixData, error: matrixError } = await supabase
        .rpc('get_permissions_matrix')

      if (matrixError) {
        console.error('❌ Matrix error:', matrixError)
        if (matrixError.code === 'PGRST116' || matrixError.code === '42883') {
          throw new Error('RPC function "get_permissions_matrix" không tồn tại. Vui lòng chạy migrations.')
        }
        throw new Error(`Lỗi load matrix: ${matrixError.message}`)
      }

      // Load stats (optional)
      const { data: statsData, error: statsError } = await supabase
        .from('v_role_permission_stats')
        .select('*')

      if (statsError && statsError.code !== 'PGRST116') {
        console.warn('⚠️ Stats not available:', statsError)
        // Don't throw error, stats are optional
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Loaded data:', {
          roles: rolesData?.length,
          permissions: permissionsData?.length,
          matrix: matrixData?.length,
          stats: statsData?.length
        })
      }

      setRoles(rolesData || [])
      setPermissions(permissionsData || [])
      setStats(statsData || [])

      // Build permission matrix
      const matrix: PermissionMatrix = {}
      rolesData?.forEach(role => {
        matrix[role.roles] = {}
        permissionsData?.forEach(perm => {
          const hasPermission = matrixData?.some(
            (m: MatrixItem) => m.role_id === role.roles && 
                              m.permission_id === perm.id && 
                              m.has_permission
          )
          matrix[role.roles][perm.id] = hasPermission || false
        })
      })
      setPermissionMatrix(matrix)
      setPendingChanges(false)

    } catch (err: any) {
      console.error('❌ Error loading data:', err)
      setError(err.message || 'Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [])

  // ========================================
  // PERMISSION TOGGLE HANDLER
  // ========================================
  const togglePermission = useCallback((roleId: number, permissionId: number) => {
    // Prevent modifying Admin role
    if (roleId === ADMIN_ROLE_ID) {
      setError('⚠️ Không thể thay đổi quyền của Admin')
      setTimeout(() => setError(null), 3000)
      return
    }

    setPermissionMatrix(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [permissionId]: !prev[roleId]?.[permissionId]
      }
    }))
    
    setPendingChanges(true)

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Toggled permission: Role ${roleId}, Permission ${permissionId}`)
    }
  }, [])

  // ========================================
  // SAVE ALL CHANGES
  // ========================================
  const handleSaveAll = useCallback(async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      if (process.env.NODE_ENV === 'development') {
        console.log('💾 Saving all permissions...')
      }

      // Save each role (except Admin)
      const savePromises = roles
        .filter(role => role.roles !== ADMIN_ROLE_ID)
        .map(async (role) => {
          const enabledPermissions = Object.entries(permissionMatrix[role.roles] || {})
            .filter(([_, enabled]) => enabled)
            .map(([permId]) => parseInt(permId))

          if (process.env.NODE_ENV === 'development') {
            console.log(`💾 Saving role ${role.name}:`, enabledPermissions)
          }

          const { error: updateError } = await supabase.rpc('update_role_permissions', {
            p_role_id: role.roles,
            p_permission_ids: enabledPermissions
          })

          if (updateError) {
            throw new Error(`Lỗi cập nhật role ${role.name}: ${updateError.message}`)
          }
        })

      await Promise.all(savePromises)

      setSuccess('✅ Đã lưu tất cả thay đổi thành công!')
      setPendingChanges(false)
      
      // Reload data to ensure consistency
      await loadData()

      setTimeout(() => setSuccess(null), 3000)

    } catch (err: any) {
      console.error('❌ Error saving permissions:', err)
      setError(err.message || 'Không thể lưu thay đổi')
    } finally {
      setSaving(false)
    }
  }, [roles, permissionMatrix, loadData])

  // ========================================
  // COMPUTED VALUES (MEMOIZED)
  // ========================================
  const groupedPermissions = useMemo(() => {
    return permissions.reduce((acc, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = []
      }
      acc[perm.module].push(perm)
      return acc
    }, {} as Record<string, Permission[]>)
  }, [permissions])

  const totalPermissions = useMemo(() => permissions.length, [permissions])
  const totalModules = useMemo(() => Object.keys(groupedPermissions).length, [groupedPermissions])

  // ========================================
  // LOADING STATE
  // ========================================
  if (loading) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Đang tải dữ liệu phân quyền...</p>
          </div>
        </div>
      </div>
    )
  }

  // ========================================
  // MAIN RENDER
  // ========================================
  return (
    <div className="w-full min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-start justify-between px-8 pt-6 pb-4 bg-white border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quản lý phân quyền</h1>
              <p className="text-sm text-gray-600">Cấu hình quyền truy cập cho từng vai trò</p>
            </div>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={loadData}
          disabled={loading || saving}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Tải lại
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mx-8 mt-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {success && (
        <div className="mx-8 mt-4">
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Pending Changes Warning */}
      {pendingChanges && (
        <div className="mx-8 mt-4">
          <Alert className="border-amber-200 bg-amber-50">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Bạn có thay đổi chưa lưu. Nhớ nhấn "Lưu tất cả" để áp dụng thay đổi.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 px-8 border-b border-gray-200 bg-white">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "overview" 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Tổng quan
        </button>
        <button
          onClick={() => setActiveTab("matrix")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "matrix" 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Ma trận phân quyền
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="px-8 py-6 space-y-6 bg-gray-50">
          {/* Info Banner */}
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              <strong>Hệ thống phân quyền:</strong> Quản lý quyền truy cập vào {totalModules} modules với {totalPermissions} quyền khác nhau.
              Admin có toàn quyền và không thể chỉnh sửa.
            </AlertDescription>
          </Alert>

          {/* Statistics Cards */}
          {stats.length > 0 ? (
            <div className="grid grid-cols-4 gap-4">
              {stats.map((stat) => {
                const role = roles.find(r => r.roles === stat.role_id)
                return (
                  <Card key={stat.role_id} className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" 
                        style={{ backgroundColor: `${role?.color}20` }}
                      >
                        {role?.icon || '👤'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{stat.role_name}</h3>
                        <p className="text-xs text-gray-500">
                          {stat.total_permissions} quyền
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Modules:</span>
                        <span className="font-medium">{stat.viewable_modules}/{totalModules}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Tạo:</span>
                          <span className="ml-1 font-medium">{stat.create_permissions}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Sửa:</span>
                          <span className="ml-1 font-medium">{stat.update_permissions}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Xóa:</span>
                          <span className="ml-1 font-medium">{stat.delete_permissions}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Thống kê không khả dụng. View v_role_permission_stats có thể chưa được tạo.
              </AlertDescription>
            </Alert>
          )}

          {/* Permissions Breakdown */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Phân tích quyền theo module
            </h3>
            <div className="space-y-3">
              {Object.entries(groupedPermissions).map(([module, perms]) => {
                const meta = MODULE_METADATA[module]
                return (
                  <div key={module} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{meta?.icon || '📦'}</span>
                      <div>
                        <p className="font-medium text-gray-900">{meta?.label || module}</p>
                        <p className="text-xs text-gray-500">{perms.length} quyền</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {perms.map(perm => (
                        <Badge key={perm.id} variant="secondary" className="text-xs">
                          {ACTION_LABELS[perm.action] || perm.action}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Matrix Tab */}
      {activeTab === "matrix" && (
        <div className="px-8 py-6 bg-gray-50 h-[calc(100vh-180px)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Ma trận phân quyền</h2>
              <p className="text-sm text-gray-600">Bật/tắt quyền cho từng vai trò. Admin không thể chỉnh sửa.</p>
            </div>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white" 
              onClick={handleSaveAll}
              disabled={saving || !pendingChanges}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Lưu tất cả
                </>
              )}
            </Button>
          </div>

          <div className="overflow-hidden bg-white rounded-lg border border-gray-200 h-[calc(100%-80px)]">
            <div className="h-full overflow-auto">
              <table className="w-full table-fixed">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-3 font-semibold text-gray-900 w-[180px]">
                      Module / Vai trò
                    </th>
                    {roles.map((role) => (
                      <th key={role.roles} className="text-center p-3">
                        <div className="flex flex-col items-center gap-1.5">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-xl" 
                            style={{ backgroundColor: `${role.color}20` }}
                          >
                            {role.icon || '👤'}
                          </div>
                          <span className="font-semibold text-gray-900 text-sm">{role.name}</span>
                          {role.roles === ADMIN_ROLE_ID && (
                            <Badge variant="secondary" className="text-xs">Full Access</Badge>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedPermissions).map(([module, perms]) => {
                    const meta = MODULE_METADATA[module]
                    return (
                      <tr key={module} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{meta?.icon || '📦'}</span>
                            <span className="font-medium text-gray-900 text-sm">{meta?.label || module}</span>
                          </div>
                        </td>
                        {roles.map((role) => (
                          <td key={role.roles} className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              {perms.map((permission) => {
                                const isChecked = !!permissionMatrix[role.roles]?.[permission.id]
                                const isAdmin = role.roles === ADMIN_ROLE_ID
                                return (
                                  <div key={permission.id} className="flex flex-col items-center gap-1">
                                    <ToggleSwitch
                                      checked={isChecked}
                                      onChange={() => togglePermission(role.roles, permission.id)}
                                      disabled={isAdmin}
                                      ariaLabel={`${role.name} - ${module} - ${permission.action}`}
                                    />
                                    <span className="text-[9px] text-gray-600 font-medium">
                                      {ACTION_LABELS[permission.action] || permission.action}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}