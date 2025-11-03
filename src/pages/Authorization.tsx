"use client"

import React, { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Building2,
  Briefcase,
  Mail,
  Bell,
  List,
  Users,
  Shield,
  Settings,
  LayoutDashboard,
  FileText,
  UserCheck,
  Calendar,
  Star,
  MailOpen,
  ChevronLeft,
  Edit,
  RefreshCw,
  X,
} from "lucide-react"

type Permission = "view" | "create" | "edit" | "delete"

type RolePermissions = {
  [moduleId: string]: {
    [key in Permission]: boolean
  }
}

type Role = {
  id: string
  name: string
  description?: string
  color?: string
  icon?: string | any
  userCount?: number
  permissions: RolePermissions
}

type Module = {
  id: string
  name: string
  icon?: string | any
}

interface AuthorizationProps {
  children?: React.ReactNode
}

// Custom Toggle Switch Component
const ToggleSwitch = ({ 
  checked, 
  onChange, 
  size = "normal"
}: { 
  checked: boolean; 
  onChange: (checked: boolean) => void;
  size?: "small" | "normal";
}) => {
  const isSmall = size === "small"
  
  return (
    <label className="toggle-switch">
      <input 
        type="checkbox" 
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={`toggle-slider ${isSmall ? 'small' : ''}`}></span>
      <style>{`
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: ${isSmall ? '36px' : '60px'};
          height: ${isSmall ? '20px' : '34px'};
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
          transition: .4s;
          border-radius: ${isSmall ? '20px' : '34px'};
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: ${isSmall ? '14px' : '26px'};
          width: ${isSmall ? '14px' : '26px'};
          left: ${isSmall ? '3px' : '4px'};
          bottom: ${isSmall ? '3px' : '4px'};
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }

        input:checked + .toggle-slider {
          background-color: #2196F3;
        }

        input:focus + .toggle-slider {
          box-shadow: 0 0 1px #2196F3;
        }

        input:checked + .toggle-slider:before {
          transform: translateX(${isSmall ? '16px' : '26px'});
        }
      `}</style>
    </label>
  )
}

const iconMap: Record<string, any> = {
  shield: Shield,
  users: Users,
  usercheck: UserCheck,
  layoutdashboard: LayoutDashboard,
  filetext: FileText,
  calendar: Calendar,
  star: Star,
  mailopen: MailOpen,
  list: List,
  settings: Settings,
}

const defaultModules: Module[] = [
  { id: "dashboard", name: "Bảng điều khiển", icon: "layoutdashboard" },
  { id: "job", name: "Mô tả công việc", icon: "filetext" },
  { id: "candidate", name: "Ứng viên", icon: "users" },
  { id: "interview", name: "Lịch phỏng vấn", icon: "calendar" },
  { id: "evaluation", name: "Đánh giá phỏng vấn", icon: "star" },
  { id: "email", name: "Quản lý email", icon: "mailopen" },
  { id: "settings", name: "Cài đặt hệ thống", icon: "settings" },
]

export default function Authorization({ children }: AuthorizationProps) {
  if (children) return <>{children}</>

  const [activeTab, setActiveTab] = useState<"overview" | "roles" | "matrix">("overview")
  const [roles, setRoles] = useState<Role[]>([])
  const [modules, setModules] = useState<Module[]>(defaultModules)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadFromSupabase()
  }, [])

  async function loadFromSupabase() {
    setLoading(true)
    setError(null)

    try {
      let loadedModules = defaultModules
      const { data: modulesData, error: modulesErr } = await supabase.from("modules").select("id,name,icon")
      if (modulesErr) {
        console.warn("Lỗi đọc modules, sử dụng mặc định:", modulesErr.message)
      } else if (modulesData && modulesData.length) {
        loadedModules = modulesData.map((m: any) => ({ id: m.id, name: m.name, icon: m.icon })) as Module[]
      }
      setModules(loadedModules)

      const { data: rolesData, error: rolesErr } = await supabase.from("roles").select("id,name,description,color,icon")
      let fetchedRoles: Role[] = []
      
      if (rolesErr) {
        console.warn("Lỗi đọc roles, sử dụng mặc định:", rolesErr.message)
        fetchedRoles = getDefaultRoles(loadedModules)
      } else if (rolesData && rolesData.length > 0) {
        fetchedRoles = rolesData.map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description || "",
          color: r.color || "#6b7280",
          icon: r.icon || "users",
          userCount: 0,
          permissions: {},
        }))
      } else {
        fetchedRoles = getDefaultRoles(loadedModules)
      }

      fetchedRoles = fetchedRoles.map((r) => ({
        ...r,
        permissions: loadedModules.reduce((acc, m) => ({ 
          ...acc, 
          [m.id]: r.permissions[m.id] || { view: false, create: false, edit: false, delete: false } 
        }), {} as RolePermissions),
      }))

      const { data: permsData, error: permsErr } = await supabase
        .from("role_permissions")
        .select("id,role_id,module_id,can_view,can_create,can_edit,can_delete")

      if (permsErr) {
        console.warn("Lỗi đọc role_permissions:", permsErr.message)
      } else if (permsData) {
        const permMap: Record<string, RolePermissions> = {}
        permsData.forEach((p: any) => {
          if (!permMap[p.role_id]) permMap[p.role_id] = {}
          permMap[p.role_id][p.module_id] = {
            view: !!p.can_view,
            create: !!p.can_create,
            edit: !!p.can_edit,
            delete: !!p.can_delete,
          }
        })

        fetchedRoles = fetchedRoles.map((r) => ({
          ...r,
          permissions: {
            ...r.permissions,
            ...permMap[r.id],
          },
        }))
      }

      const { data: usersData, error: usersErr } = await supabase.from("users").select("id,role_id")
      if (usersErr) {
        console.warn("Lỗi đọc users (có thể bảng không tồn tại), bỏ qua userCount:", usersErr.message)
      } else if (usersData) {
        const counts: Record<string, number> = {}
        usersData.forEach((u: any) => {
          if (!u.role_id) return
          counts[u.role_id] = (counts[u.role_id] || 0) + 1
        })
        fetchedRoles = fetchedRoles.map((r) => ({ ...r, userCount: counts[r.id] || 0 }))
      }

      setRoles(fetchedRoles)
    } catch (e: any) {
      console.error(e)
      setError(e.message || "Lỗi khi tải dữ liệu")
    } finally {
      setLoading(false)
    }
  }

  function getDefaultRoles(modules: Module[]): Role[] {
    const allModules = modules.reduce((acc, m) => ({
      ...acc,
      [m.id]: { view: true, create: true, edit: true, delete: true }
    }), {} as RolePermissions)

    const hrPermissions = modules.reduce((acc, m) => ({
      ...acc,
      [m.id]: m.id === "settings" 
        ? { view: false, create: false, edit: false, delete: false }
        : { view: true, create: true, edit: true, delete: false }
    }), {} as RolePermissions)

    const interviewerPermissions = modules.reduce((acc, m) => ({
      ...acc,
      [m.id]: ["interview", "evaluation"].includes(m.id)
        ? { view: true, create: true, edit: true, delete: false }
        : { view: true, create: false, edit: false, delete: false }
    }), {} as RolePermissions)

    const userPermissions = modules.reduce((acc, m) => ({
      ...acc,
      [m.id]: { view: true, create: false, edit: false, delete: false }
    }), {} as RolePermissions)

    return [
      {
        id: "admin",
        name: "Admin",
        description: "Quản trị viên hệ thống",
        color: "#7c3aed",
        icon: "shield",
        userCount: 0,
        permissions: allModules,
      },
      {
        id: "hr",
        name: "HR",
        description: "Nhân viên nhân sự",
        color: "#2563eb",
        icon: "users",
        userCount: 0,
        permissions: hrPermissions,
      },
      {
        id: "interviewer",
        name: "Interviewer",
        description: "Người phỏng vấn",
        color: "#059669",
        icon: "usercheck",
        userCount: 0,
        permissions: interviewerPermissions,
      },
      {
        id: "user",
        name: "User",
        description: "Người dùng cơ bản",
        color: "#6b7280",
        icon: "users",
        userCount: 0,
        permissions: userPermissions,
      },
    ]
  }

  function mapIcon(iconKey?: string | any) {
    if (!iconKey) return Users
    if (typeof iconKey === "string") {
      const key = iconKey.toLowerCase()
      return iconMap[key] || Users
    }
    return iconKey
  }

  const handleEditRole = (role: Role) => {
    setEditingRole({ ...role })
    setIsEditDialogOpen(true)
  }

  const handleSaveRole = async () => {
    if (!editingRole) return

    setRoles((prev) => prev.map((r) => (r.id === editingRole.id ? editingRole : r)))
    setIsEditDialogOpen(false)

    try {
      const { error: upsertErr } = await supabase.from("roles").upsert(
        [
          {
            id: editingRole.id,
            name: editingRole.name,
            description: editingRole.description,
            color: editingRole.color,
            icon: typeof editingRole.icon === "string" ? editingRole.icon : undefined,
          },
        ],
        { onConflict: "id" },
      )
      if (upsertErr) throw upsertErr

      const { error: delErr } = await supabase.from("role_permissions").delete().eq("role_id", editingRole.id)
      if (delErr) console.warn("Lỗi xóa permissions cũ:", delErr.message)

      const inserts: any[] = []
      Object.entries(editingRole.permissions).forEach(([moduleId, perms]) => {
        inserts.push({ 
          role_id: editingRole.id, 
          module_id: moduleId, 
          can_view: perms.view, 
          can_create: perms.create, 
          can_edit: perms.edit, 
          can_delete: perms.delete 
        })
      })
      if (inserts.length) {
        const { error: insertErr } = await supabase.from("role_permissions").insert(inserts)
        if (insertErr) console.warn("Lỗi insert permissions:", insertErr.message)
      }
    } catch (e) {
      console.error("Lỗi lưu role", e)
      setError("Không thể lưu thay đổi. Kiểm tra console để biết chi tiết.")
      loadFromSupabase()
    } finally {
      setEditingRole(null)
    }
  }

  const handlePermissionToggle = (roleId: string, moduleId: string, permission: Permission) => {
    setRoles(
      roles.map((role) => {
        if (role.id === roleId) {
          const currentPerms = role.permissions[moduleId] || {
            view: false,
            create: false,
            edit: false,
            delete: false,
          }
          return {
            ...role,
            permissions: {
              ...role.permissions,
              [moduleId]: {
                ...currentPerms,
                [permission]: !currentPerms[permission],
              },
            },
          }
        }
        return role
      }),
    )
  }

  const totalUsers = roles.reduce((sum, role) => sum + (role.userCount || 0), 0)
  const activeModules = modules.length
  const definedRoles = roles.length

  return (
    <div className="w-full min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-start justify-between px-8 pt-6 pb-4 bg-white border-b border-gray-200">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-900">Phân quyền hệ thống</h1>
          </div>
          <p className="text-gray-600">Quản lý vai trò và quyền truy cập của người dùng</p>
        </div>
        <button onClick={loadFromSupabase} className="text-sm text-purple-600 hover:text-purple-700">
          Tải lại
        </button>
      </div>

      {error && (
        <div className="mx-8 mt-4 p-4 border border-red-200 bg-red-50 rounded-lg">
          <p className="text-sm text-red-700">Lỗi: {error}</p>
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
          onClick={() => setActiveTab("roles")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "roles" 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Quản lý vai trò
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
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Cài đặt hệ thống</h2>
              <button onClick={loadFromSupabase} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                <RefreshCw className="w-4 h-4" />
                <span>Làm mới</span>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-2">Quản lý cấu hình và tùy chỉnh hệ thống</p>
            <p className="text-xs text-gray-500">Cập nhật lần cuối: {new Date().toLocaleString()}</p>
          </Card>

          <Card className="p-6 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <List className="w-5 h-5 text-blue-600 mt-0.5" />
              <p className="text-sm text-blue-900">
                Module Phân quyền cho phép quản lý vai trò và kiểm soát quyền truy cập vào các chức năng của hệ thống HR/Recruitment.
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-4 gap-4">
            {roles.map((role) => {
              const Icon = mapIcon(role.icon)
              return (
                <Card key={role.id} className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center" 
                      style={{ backgroundColor: `${role.color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: role.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{role.name}</h3>
                      <p className="text-xs text-gray-500">{role.description}</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{role.userCount ?? 0}</p>
                </Card>
              )
            })}
          </div>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-6">Thống kê phân quyền</h3>
            <div className="grid grid-cols-3 gap-8">
              <div className="text-center">
                <p className="text-4xl font-bold text-blue-600 mb-2">{totalUsers}</p>
                <p className="text-sm text-gray-600">Tổng số người dùng</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-green-600 mb-2">{activeModules}</p>
                <p className="text-sm text-gray-600">Modules hệ thống</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-purple-600 mb-2">{definedRoles}</p>
                <p className="text-sm text-gray-600">Vai trò được định nghĩa</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Vai trò phổ biến nhất</p>
                <p className="font-semibold text-gray-900">{roles[0]?.name ?? "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Module đang hoạt động</p>
                <p className="font-semibold text-gray-900">{modules.length} modules</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === "roles" && (
        <div className="px-8 py-6 bg-gray-50">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quản lý vai trò</h2>
              <div className="space-y-4">
                {roles.map((role) => {
                  const Icon = mapIcon(role.icon)
                  const enabledModules = Object.entries(role.permissions || {}).filter(
                    ([_, perms]) => Object.values(perms).some((v) => v)
                  )

                  return (
                    <div key={role.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div 
                            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" 
                            style={{ backgroundColor: `${role.color}20` }}
                          >
                            <Icon className="w-6 h-6" style={{ color: role.color }} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 mb-1">{role.name}</h3>
                            <p className="text-sm text-gray-600 mb-3">{role.description}</p>
                            <div className="flex flex-wrap gap-2">
                              {enabledModules.slice(0, 4).map(([moduleId]) => {
                                const module = modules.find((m) => m.id === moduleId)
                                return (
                                  <Badge key={moduleId} className="bg-blue-600 text-white hover:bg-blue-700">
                                    {module?.name ?? moduleId}: Có
                                  </Badge>
                                )
                              })}
                              {enabledModules.length > 4 && (
                                <Badge variant="secondary">+{enabledModules.length - 4} modules khác</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">{role.userCount} người dùng</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEditRole(role)} 
                            className="flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            <span>Chỉnh sửa</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Matrix Tab */}
      {activeTab === "matrix" && (
        <div className="px-8 py-6 bg-gray-50 h-[calc(100vh-180px)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Ma trận phân quyền</h2>
              <p className="text-sm text-gray-600">Quản lý quyền truy cập chi tiết cho từng vai trò và module</p>
            </div>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white" 
              onClick={async () => {
                try {
                  setLoading(true)
                  setError(null)
                  
                  const inserts: any[] = []
                  roles.forEach((r) => {
                    Object.entries(r.permissions || {}).forEach(([moduleId, perms]) => {
                      inserts.push({ 
                        role_id: r.id, 
                        module_id: moduleId, 
                        can_view: perms.view, 
                        can_create: perms.create, 
                        can_edit: perms.edit, 
                        can_delete: perms.delete 
                      })
                    })
                  })
                  
                  // Xóa tất cả permissions hiện có
                  const { error: deleteError } = await supabase
                    .from("role_permissions")
                    .delete()
                    .gte('id', 0)
                  
                  if (deleteError) {
                    console.warn("Lỗi xóa:", deleteError)
                  }
                  
                  // Insert permissions mới
                  if (inserts.length) {
                    const { error: insertError } = await supabase
                      .from("role_permissions")
                      .insert(inserts)
                    
                    if (insertError) {
                      throw insertError
                    }
                  }
                  
                  // Hiển thị thông báo thành công
                  alert("Lưu thay đổi thành công!")
                  
                } catch (e: any) {
                  console.error(e)
                  setError(`Không thể lưu ma trận phân quyền: ${e.message || 'Lỗi không xác định'}`)
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>

          <div className="overflow-hidden bg-white rounded-lg border border-gray-200 h-[calc(100%-80px)]">
            <div className="h-full overflow-y-auto">
              <table className="w-full table-fixed">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-3 font-semibold text-gray-900 w-[180px]">
                      Module / Vai trò
                    </th>
                    {roles.map((role) => {
                      const Icon = mapIcon(role.icon)
                      return (
                        <th key={role.id} className="text-center p-3">
                          <div className="flex flex-col items-center gap-1.5">
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center" 
                              style={{ backgroundColor: `${role.color}20` }}
                            >
                              <Icon className="w-5 h-5" style={{ color: role.color }} />
                            </div>
                            <span className="font-semibold text-gray-900 text-sm">{role.name}</span>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((module) => {
                    const ModuleIcon = mapIcon(module.icon)
                    return (
                      <tr key={module.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <ModuleIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
                            <span className="font-medium text-gray-900 text-sm">{module.name}</span>
                          </div>
                        </td>
                        {roles.map((role) => (
                          <td key={role.id} className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              {(["view", "create", "edit", "delete"] as Permission[]).map((permission) => {
                                const isChecked = !!role.permissions?.[module.id]?.[permission]
                                return (
                                  <div key={permission} className="flex flex-col items-center gap-1">
                                    <ToggleSwitch
                                      checked={isChecked}
                                      onChange={() => handlePermissionToggle(role.id, module.id, permission)}
                                      size="small"
                                    />
                                    <span className="text-[9px] text-gray-600 font-medium">
                                      {permission === "view" 
                                        ? "Xem" 
                                        : permission === "create" 
                                        ? "Tạo" 
                                        : permission === "edit" 
                                        ? "Sửa" 
                                        : "Xóa"}
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

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Chỉnh sửa vai trò</span>
              <button 
                onClick={() => setIsEditDialogOpen(false)} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </DialogTitle>
          </DialogHeader>
          {editingRole && (
            <div className="space-y-4 pt-4">
              <p className="text-sm text-gray-600">
                Cập nhật thông tin của vai trò "{editingRole.name}". Các thay đổi sẽ được áp dụng cho tất cả người dùng có vai trò này.
              </p>

              <div className="space-y-2">
                <Label htmlFor="role-name">Tên vai trò</Label>
                <Input 
                  id="role-name" 
                  value={editingRole.name} 
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })} 
                  className="bg-gray-50" 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role-description">Mô tả</Label>
                <Input 
                  id="role-description" 
                  value={editingRole.description} 
                  onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role-color">Màu sắc</Label>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-lg border-2 border-gray-200" 
                    style={{ backgroundColor: editingRole.color }} 
                  />
                  <Input 
                    id="role-color" 
                    value={editingRole.color} 
                    onChange={(e) => setEditingRole({ ...editingRole, color: e.target.value })} 
                    className="flex-1 bg-gray-50" 
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Hủy
                </Button>
                <Button onClick={handleSaveRole} className="bg-blue-600 hover:bg-blue-700">
                  <RefreshCw className="w-4 w-4 mr-2" />
                  Lưu thay đổi
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}