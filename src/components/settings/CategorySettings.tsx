"use client"

import { useEffect, useState } from "react"
import {
  TrendingUp,
  Star,
  Building,
  Zap,
  Mic,
  Briefcase,
  MapPin,
  Target,
  GraduationCap,
  Users,
  AlertTriangle,
  Building2,
  Plus,
  Trash2,
  Download,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from '@/lib/supabaseClient'

// Icon mapping
const iconMap: Record<string, any> = {
  "trending-up": TrendingUp,
  star: Star,
  building: Building,
  zap: Zap,
  mic: Mic,
  briefcase: Briefcase,
  "map-pin": MapPin,
  target: Target,
  "graduation-cap": GraduationCap,
  users: Users,
  "alert-triangle": AlertTriangle,
  "building-2": Building2,
}

type Category = {
  id: string
  name: string
  type?: string
  slug?: string
  icon?: string
  icon_color?: string
  sort_order?: number
}

type CategoryItem = {
  id: string
  category_id: string
  name: string
  slug: string
  sort_order?: number
  is_active?: boolean
}

export default function CategorySettingsPage() {
  // state
  const [categories, setCategories] = useState<Category[]>([])
  const [itemsByCategory, setItemsByCategory] = useState<Record<string, CategoryItem[]>>({})
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // derived
  const selectedCategory = categories.find(c => c.id === selectedCategoryId) || null
  const items = selectedCategory ? (itemsByCategory[selectedCategory.id] || []) : []

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // fetch categories and their items from Supabase
  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      // fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('cv_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (categoriesError) throw categoriesError
      let cats = (categoriesData || []) as Category[]
      const validCats = cats.filter((c) => c && c.id)
      setCategories(validCats)

      // fetch items from cv_items table
      const { data: itemsData, error: itemsError } = await supabase
        .from('cv_items')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (itemsError) throw itemsError

      // group items by category_id
      const grouped: Record<string, CategoryItem[]> = {}
      for (const item of (itemsData || [])) {
        if (!item || !item.category_id) continue
        if (!grouped[item.category_id]) grouped[item.category_id] = []
        grouped[item.category_id].push(item as CategoryItem)
      }
      setItemsByCategory(grouped)

      // set default selected if none
      if (!selectedCategoryId && validCats.length > 0) {
        const defaultCat = validCats.find(c => c.name === "Vị trí công việc") || validCats[0]
        setSelectedCategoryId(defaultCat.id)
      }
    } catch (err: any) {
      console.error("Fetch categories/items error:", err)
      setError(err?.message || "Lỗi khi tải dữ liệu")
    } finally {
      setLoading(false)
    }
  }

  // change selection
  const handleCategoryChange = (categoryId: string) => {
    if (!categoryId) return
    setSelectedCategoryId(categoryId)
    setNewItemName("")
  }

  // add an item (writes to supabase then updates local state)
  const handleAddItem = async () => {
    if (!selectedCategory) return
    const name = newItemName.trim()
    if (!name) return

    setSaving(true)
    setError(null)
    try {
      // Generate slug from name
      const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

      const payload = {
        category_id: selectedCategory.id,
        name: name,
        slug: slug,
        sort_order: items.length + 1,
      }

      const { data, error } = await supabase
        .from('cv_items')
        .insert([payload])
        .select()

      if (error) throw error
      const inserted = (data && data[0]) ? (data[0] as CategoryItem) : null

      if (inserted) {
        setItemsByCategory(prev => {
          const prevList = prev[selectedCategory.id] || []
          return { ...prev, [selectedCategory.id]: [...prevList, inserted] }
        })
      }
      setNewItemName("")
    } catch (err: any) {
      console.error("Add item error:", err)
      setError(err?.message || "Lỗi khi thêm mục")
    } finally {
      setSaving(false)
    }
  }

  // delete item (confirmation + supabase + local update)
  const handleDeleteItem = async (itemId: string) => {
    if (!selectedCategory) return
    if (!confirm("Bạn có chắc chắn muốn xóa mục này?")) return

    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase
        .from('cv_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error

      setItemsByCategory(prev => {
        const prevList = prev[selectedCategory.id] || []
        return { ...prev, [selectedCategory.id]: prevList.filter(i => i.id !== itemId) }
      })
    } catch (err: any) {
      console.error("Delete item error:", err)
      setError(err?.message || "Lỗi khi xóa mục")
    } finally {
      setSaving(false)
    }
  }

  // export CSV
  const handleExport = async () => {
    try {
      const rows: string[] = ["category_id,category_name,item_id,item_name,item_slug"]
      for (const cat of categories) {
        const list = itemsByCategory[cat.id] || []
        if (list.length === 0) {
          rows.push(`${cat.id},"${cat.name}",,,`)
        } else {
          for (const it of list) {
            rows.push(`${cat.id},"${cat.name}",${it.id},"${(it.name || '').replace(/"/g, '""')}","${it.slug}"`)
          }
        }
      }
      const csv = rows.join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `categories_export_${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Export error:", err)
      alert("Không thể xuất dữ liệu.")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Category Management Section */}
        <div className="bg-white rounded-lg border p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Building2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Quản lý danh mục</h2>
              <p className="text-sm text-gray-500">Quản lý dữ liệu master cho các dropdown trong hệ thống</p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Category Selector */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Danh mục</label>
            <Select value={selectedCategoryId ?? ""} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loading ? "Đang tải..." : "Chọn danh mục"} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Category Display */}
          {selectedCategory && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg">
                  {(() => {
                    const Icon = iconMap[selectedCategory.icon || ""]
                    return Icon ? <Icon className="h-5 w-5" /> : null
                  })()}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{selectedCategory.name}</h3>
                  <p className="text-sm text-gray-600">
                    Danh sách {selectedCategory.name.toLowerCase()} trong công ty
                  </p>
                </div>
                <Badge variant="secondary" className="bg-blue-600 text-white">
                  {items.length} mục
                </Badge>
              </div>
            </div>
          )}

          {/* Add New Item */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Thêm mục mới</label>
            <div className="flex gap-2">
              <Input
                placeholder={selectedCategory ? `Thêm ${selectedCategory.name.toLowerCase()} mới...` : "Thêm mục mới..."}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddItem()
                }}
                className="flex-1"
                disabled={!selectedCategory || saving || loading}
              />
              <Button onClick={handleAddItem} className="bg-blue-600 hover:bg-blue-700" disabled={!selectedCategory || saving || loading}>
                <Plus className="h-4 w-4 mr-2" />
                Thêm
              </Button>
            </div>
          </div>

          {/* Items List */}
          <div className="mb-6">
            <div className="space-y-2">
              {loading ? (
                <div className="text-sm text-gray-500">Đang tải mục...</div>
              ) : items.length === 0 ? (
                <div className="text-sm text-gray-500">Chưa có mục nào.</div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 px-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({item.slug})</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={saving || loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 bg-transparent" onClick={handleExport} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              Xuất dữ liệu
            </Button>
            <Button variant="outline" className="flex-1 bg-transparent" disabled={loading}>
              <Upload className="h-4 w-4 mr-2" />
              Nhập dữ liệu
            </Button>
          </div>
        </div>

        {/* Category Overview Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tổng quan danh mục</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((category) => {
              const Icon = iconMap[category.icon || ""]
              const count = (itemsByCategory[category.id] || []).length
              return (
                <Card
                  key={category.id}
                  className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleCategoryChange(category.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${category.icon_color ?? '#ddd'}20` }}>
                      {Icon && <Icon className="h-5 w-5" style={{ color: category.icon_color ?? '#666' }} />}
                    </div>
                    <Badge variant="secondary" className="bg-blue-600 text-white">
                      {count} mục
                    </Badge>
                  </div>
                  <h3 className="font-medium text-gray-900 text-sm">{category.name}</h3>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}