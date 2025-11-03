// src/pages/EmailManagementPage.tsx
"use client"

import { useState, useEffect } from "react"
import { Search, Plus, Mail, Send, TrendingUp, Clock, FileText, Eye, Filter, Sparkles, Users } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabaseClient"

interface EmailCategory {
  id: string
  name: string
  description?: string
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category_id: string
  variables: string[]
  is_default: boolean
  usage_count: number
  created_at: string
  email_categories: EmailCategory | null
}

const getCategoryBadge = (category: string) => {
  const colors: Record<string, string> = {
    'Interview': 'bg-purple-50 text-purple-700 border-purple-200',
    'Offer': 'bg-orange-50 text-orange-700 border-orange-200',
    'Rejection': 'bg-red-50 text-red-700 border-red-200',
    'General': 'bg-blue-50 text-blue-700 border-blue-200',
    'Reminder': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'Follow-up': 'bg-green-50 text-green-700 border-green-200',
    'Other': 'bg-gray-50 text-gray-700 border-gray-200'
  }
  return (
    <Badge variant="outline" className={colors[category] || 'bg-gray-50 text-gray-700'}>
      {category}
    </Badge>
  )
}

export function EmailManagementPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [categories, setCategories] = useState<EmailCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTab, setCurrentTab] = useState<'templates' | 'history' | 'statistical'>('templates')
  const [stats, setStats] = useState({
    totalSent: 0,
    openRate: '0.0',
    waitingToSend: 0,
    totalTemplates: 0
  })

  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [isTemplateOpen, setIsTemplateOpen] = useState(false)
  const [isTestEmailOpen, setIsTestEmailOpen] = useState(false)
  const [viewTemplate, setViewTemplate] = useState<EmailTemplate | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [composeForm, setComposeForm] = useState({
    candidate_id: '',
    template_id: '',
    subject: '',
    body: '',
    scheduled_at: ''
  })

  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject: '',
    body: '',
    category_id: '',
    is_default: false
  })

  const [testEmailForm, setTestEmailForm] = useState({
    test_email: '',
    template_id: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    await Promise.all([
      fetchTemplates(),
      fetchCategories(),
      fetchStats()
    ])
    setLoading(false)
  }

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('cv_email_templates')
        .select(`
          *,
          cv_email_categories (
            id,
            name,
            description
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (data) {
        const transformedData = data.map(item => ({
          ...item,
          email_categories: item.cv_email_categories
        }))
        setTemplates(transformedData as EmailTemplate[])
      }
      if (error) console.error('Error fetching templates:', error)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('cv_email_categories')
        .select('*')
        .order('name')

      if (data) setCategories(data as EmailCategory[])
      if (error) console.error('Error fetching categories:', error)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const { count: sentCount } = await supabase
        .from('cv_emails')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent')

      const { data: eventsData } = await supabase
        .from('cv_email_events')
        .select('event_type, email_id')

      const { count: queueCount } = await supabase
        .from('cv_email_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { count: templatesCount } = await supabase
        .from('cv_email_templates')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      const totalSent = sentCount || 0
      const uniqueOpens = new Set(eventsData?.filter(e => e.event_type === 'opened').map(e => e.email_id)).size
      const openRate = totalSent > 0 ? (uniqueOpens / totalSent) * 100 : 0

      setStats({
        totalSent,
        openRate: openRate.toFixed(1),
        waitingToSend: queueCount || 0,
        totalTemplates: templatesCount || 0
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleComposeSubmit = async () => {
    if (!composeForm.candidate_id || !composeForm.subject || !composeForm.body) {
      alert('Vui lòng điền đầy đủ thông tin')
      return
    }

    setIsSaving(true)

    try {
      const { error } = await supabase
        .from('cv_emails')
        .insert([{
          candidate_id: composeForm.candidate_id,
          template_id: composeForm.template_id || null,
          subject: composeForm.subject,
          body: composeForm.body,
          composition_type: 'manual',
          status: composeForm.scheduled_at ? 'scheduled' : 'pending',
          scheduled_at: composeForm.scheduled_at || null
        }])

      if (error) throw error

      alert('✓ Email đã được thêm vào hàng đợi!')
      setIsComposeOpen(false)
      resetComposeForm()
      fetchStats()
    } catch (error: any) {
      alert('Có lỗi khi gửi email: ' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateTemplate = async () => {
    if (!templateForm.name || !templateForm.subject || !templateForm.body || !templateForm.category_id) {
      alert('Vui lòng điền đầy đủ thông tin template')
      return
    }

    setIsSaving(true)

    try {
      const variableMatches = templateForm.body.match(/\{\{(\w+)\}\}/g)
      const variables = variableMatches ? variableMatches.map(v => v.replace(/[{}]/g, '')) : []

      const { data, error } = await supabase
        .from('cv_email_templates')
        .insert([{
          name: templateForm.name,
          subject: templateForm.subject,
          body: templateForm.body,
          category_id: templateForm.category_id,
          variables: variables,
          is_default: templateForm.is_default,
          is_active: true,
          usage_count: 0
        }])
        .select(`
          *,
          cv_email_categories (
            id,
            name
          )
        `)

      if (error) throw error

      if (data && data[0]) {
        const transformedData = {
          ...data[0],
          email_categories: data[0].cv_email_categories
        }
        setTemplates(prev => [transformedData as EmailTemplate, ...prev])
        alert('✓ Tạo template thành công!')
        setIsTemplateOpen(false)
        resetTemplateForm()
        fetchStats()
      }
    } catch (error: any) {
      alert('Có lỗi khi tạo template: ' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUseTemplate = (template: EmailTemplate) => {
    setComposeForm(prev => ({
      ...prev,
      template_id: template.id,
      subject: template.subject,
      body: template.body
    }))
    setIsComposeOpen(true)
  }

  const resetComposeForm = () => {
    setComposeForm({
      candidate_id: '',
      template_id: '',
      subject: '',
      body: '',
      scheduled_at: ''
    })
  }

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      subject: '',
      body: '',
      category_id: '',
      is_default: false
    })
  }

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         t.subject.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || t.category_id === selectedCategory
    return matchesSearch && matchesCategory
  })

  const getCategoryCounts = () => {
    const counts: Record<string, number> = {}
    categories.forEach(cat => {
      counts[cat.name] = templates.filter(t => t.category_id === cat.id).length
    })
    return counts
  }

  const categoryCounts = getCategoryCounts()

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-lg">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Quản lý Email</h1>
            <p className="text-sm text-muted-foreground">
              Quản lý {stats.totalTemplates} mẫu email chuyên nghiệp trong {categories.length} danh mục
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsTestEmailOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Test Email
          </Button>
          <Button variant="outline" onClick={() => setIsTemplateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo Template
          </Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            onClick={() => setIsComposeOpen(true)}
          >
            <Send className="mr-2 h-4 w-4" />
            Soạn Email
          </Button>
        </div>
      </div>

      {/* Success Message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
        <div className="text-green-600 mt-0.5">✓</div>
        <div className="flex-1">
          <p className="text-sm text-gray-700">
            Đã tải thành công {stats.totalTemplates} mẫu email chuyên nghiệp với {categories.length} danh mục: 
            {Object.entries(categoryCounts).map(([name, count], idx) => (
              <span key={name}> {name} ({count}){idx < Object.keys(categoryCounts).length - 1 ? ',' : '.'}</span>
            ))}
          </p>
          <p className="text-sm text-orange-600 mt-1">
            <strong>Lưu ý:</strong> Để gửi email thực, vui lòng cấu hình Resend API key trong Cài đặt và kiểm tra cấu hình email.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Email đã gửi</p>
                <div className="text-3xl font-bold">{stats.totalSent}</div>
              </div>
              <div className="bg-blue-600 p-3 rounded-xl">
                <Send className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Tỷ lệ mở email</p>
                <div className="text-3xl font-bold">{stats.openRate} %</div>
              </div>
              <div className="bg-green-600 p-3 rounded-xl">
                <Mail className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Đang chờ gửi</p>
                <div className="text-3xl font-bold">{stats.waitingToSend}</div>
              </div>
              <div className="bg-orange-600 p-3 rounded-xl">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Mẫu Email</p>
                <div className="text-3xl font-bold">{stats.totalTemplates}</div>
              </div>
              <div className="bg-purple-600 p-3 rounded-xl">
                <FileText className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b">
        <button
          className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
            currentTab === 'templates'
              ? 'text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setCurrentTab('templates')}
        >
          Templates ( {filteredTemplates.length} )
          {currentTab === 'templates' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
        <button
          className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
            currentTab === 'history'
              ? 'text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setCurrentTab('history')}
        >
          History
          {currentTab === 'history' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
        <button
          className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
            currentTab === 'statistical'
              ? 'text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setCurrentTab('statistical')}
        >
          Statistical
          {currentTab === 'statistical' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
      </div>

      {/* Templates Section */}
      {currentTab === 'templates' && (
        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Email Templates</h3>
            <div className="flex items-center gap-3">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input 
                  placeholder="Tìm kiếm templates..."
                  className="pl-10 bg-gray-100 border-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="ghost" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder="Tất cả danh mục" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">Tất cả danh mục</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Templates Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-4">Đang tải dữ liệu...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="font-medium">Không tìm thấy template</p>
                <p className="text-sm text-muted-foreground mb-4">Tạo template đầu tiên của bạn!</p>
                <Button onClick={() => setIsTemplateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Tạo Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <Card key={template.id} className="border hover:shadow-lg transition-shadow bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-base">{template.name}</h4>
                          {template.is_default && (
                            <>
                              <span className="text-xs">⭐</span>
                              <span className="text-xs text-gray-500">Mặc định</span>
                            </>
                          )}
                        </div>
                        {getCategoryBadge(template.email_categories?.name || 'General')}
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewTemplate(template)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{template.subject}</p>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                      <span>{template.variables?.length || 0} biến</span>
                      <span>Đã dùng {template.usage_count || 0} lần</span>
                    </div>

                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => handleUseTemplate(template)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Sử dụng Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {currentTab === 'history' && (
        <div className="text-center py-12">
          <p className="text-gray-500">Lịch sử Email - Đang phát triển</p>
        </div>
      )}

      {currentTab === 'statistical' && (
        <div className="text-center py-12">
          <p className="text-gray-500">Thống kê - Đang phát triển</p>
        </div>
      )}

      {/* Compose Email Dialog */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              <DialogTitle className="text-xl">Soạn Email</DialogTitle>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Soạn và gửi email tuyển dụng với template hoặc nội dung tự tạo. Có thể gửi ngay, lên lịch gửi sau, hoặc lưu làm nháp.
            </p>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            {/* Thông tin cơ bản */}
            <div>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Thông tin cơ bản
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Người nhận *</label>
                  <Input 
                    placeholder="email1@example.com, email2@example.com"
                    className="bg-gray-50"
                    value={composeForm.candidate_id}
                    onChange={(e) => setComposeForm(prev => ({ ...prev, candidate_id: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Tiêu đề *</label>
                  <Input 
                    placeholder="Tiêu đề email"
                    className="bg-gray-50"
                    value={composeForm.subject}
                    onChange={(e) => setComposeForm(prev => ({ ...prev, subject: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium mb-2">CC (Tùy chọn)</label>
                  <Input 
                    placeholder="cc1@example.com, cc2@example.com"
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Độ ưu tiên</label>
                  <Select defaultValue="normal">
                    <SelectTrigger className="bg-gray-50">
                      <SelectValue placeholder="Bình thường" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="high">Cao</SelectItem>
                      <SelectItem value="normal">Bình thường</SelectItem>
                      <SelectItem value="low">Thấp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Chọn Template */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  Chọn Template (Tùy chọn)
                </h3>
                <Button variant="outline" size="sm" onClick={() => setIsTemplateOpen(true)}>
                  Tự tạo
                </Button>
              </div>

              {composeForm.template_id ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-900">Template đã chọn</p>
                      <p className="text-sm text-blue-700 mt-1">{templates.find(t => t.id === composeForm.template_id)?.name}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setComposeForm(prev => ({ ...prev, template_id: '', subject: '', body: '' }))}>
                      Xóa
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2 mb-3">
                    <Input 
                      placeholder="Tìm template..."
                      className="flex-1 bg-gray-50"
                    />
                    <Select defaultValue="all">
                      <SelectTrigger className="w-48 bg-gray-50">
                        <SelectValue placeholder="Tất cả danh mục" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">Tất cả danh mục</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                    {templates.slice(0, 4).map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleUseTemplate(template)}
                        className="text-left border rounded-lg p-3 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          {template.is_default && <span className="text-yellow-500">⭐</span>}
                        </div>
                        {getCategoryBadge(template.email_categories?.name || 'General')}
                        <p className="text-xs text-gray-600 mt-2 line-clamp-2">{template.subject}</p>
                        <p className="text-xs text-gray-500 mt-2">Sử dụng: {template.usage_count || 0} lần</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Nội dung */}
            {composeForm.body && (
              <div className="border-t pt-6">
                <label className="block text-sm font-medium mb-2">Nội dung email</label>
                <Textarea 
                  placeholder="Nội dung email sẽ được điền tự động từ template..."
                  className="min-h-[200px] bg-gray-50"
                  value={composeForm.body}
                  onChange={(e) => setComposeForm(prev => ({ ...prev, body: e.target.value }))}
                />
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="h-4 w-4" />
                <span>0 người nhận</span>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setIsComposeOpen(false); resetComposeForm(); }} disabled={isSaving}>
                  Hủy
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleComposeSubmit} disabled={isSaving}>
                  <Send className="mr-2 h-4 w-4" />
                  {isSaving ? 'Đang gửi...' : 'Gửi Email'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Template Dialog */}
      <Dialog open={isTemplateOpen} onOpenChange={setIsTemplateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Tạo Email Template mới</DialogTitle>
            <p className="text-sm text-gray-500 mt-2">
              Tạo template email tùy chỉnh cho quy trình tuyển dụng
            </p>
          </DialogHeader>

          <div className="space-y-5 mt-6">
            <div>
              <label className="block text-sm font-semibold mb-2">Tên template</label>
              <Input 
                placeholder="VD: Mời phỏng vấn vòng 3"
                className="bg-gray-50"
                value={templateForm.name}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Danh mục</label>
              <Select value={templateForm.category_id} onValueChange={(val) => setTemplateForm(prev => ({ ...prev, category_id: val }))}>
                <SelectTrigger className="bg-gray-50">
                  <SelectValue placeholder="🎉 Khác" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name === 'Interview' && '🎤 '}
                      {cat.name === 'Offer' && '🎉 '}
                      {cat.name === 'Rejection' && '❌ '}
                      {cat.name === 'Other' && '📋 '}
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Tiêu đề email</label>
              <Input 
                placeholder="VD: [{{companyName}}] Mời phỏng vấn - {{position}}"
                className="bg-gray-50"
                value={templateForm.subject}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Nội dung email</label>
              <Textarea 
                placeholder="Nhập nội dung email... Sử dụng {{variableName}} để tạo biến động"
                className="min-h-[250px] bg-gray-50 font-mono text-sm"
                value={templateForm.body}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, body: e.target.value }))}
              />
              <p className="text-xs text-gray-500 mt-2">
                Sử dụng dấu ngoặc nhọn đôi để tạo biến: {`{{candidateName}}, {{position}}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="is_default"
                checked={templateForm.is_default}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, is_default: e.target.checked }))}
                className="rounded w-4 h-4"
              />
              <label htmlFor="is_default" className="text-sm">Đặt làm template mặc định</label>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => { setIsTemplateOpen(false); resetTemplateForm(); }} disabled={isSaving}>
                Hủy
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreateTemplate} disabled={isSaving}>
                <Plus className="mr-2 h-4 w-4" />
                {isSaving ? 'Đang tạo...' : 'Tạo Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Template Dialog */}
      <Dialog open={!!viewTemplate} onOpenChange={() => setViewTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewTemplate?.name}</DialogTitle>
          </DialogHeader>
          {viewTemplate && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getCategoryBadge(viewTemplate.email_categories?.name || 'General')}
                {viewTemplate.is_default && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Mặc định</Badge>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Tiêu đề</label>
                <p className="text-gray-900 mt-1">{viewTemplate.subject}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Nội dung</label>
                <div className="mt-1 p-4 bg-gray-50 rounded-lg whitespace-pre-wrap font-mono text-sm">
                  {viewTemplate.body}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Biến sử dụng</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {viewTemplate.variables?.length > 0 ? (
                    viewTemplate.variables.map((v, idx) => (
                      <Badge key={idx} variant="outline" className="font-mono">{`{{${v}}}`}</Badge>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">Không có biến</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium text-gray-500">Số lần sử dụng</label>
                  <p className="text-2xl font-bold">{viewTemplate.usage_count || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Ngày tạo</label>
                  <p className="text-sm">{new Date(viewTemplate.created_at).toLocaleDateString('vi-VN')}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog open={isTestEmailOpen} onOpenChange={setIsTestEmailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kiểm tra cấu hình Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email nhận thử nghiệm *</label>
              <Input 
                type="email"
                placeholder="your-email@example.com"
                value={testEmailForm.test_email}
                onChange={(e) => setTestEmailForm(prev => ({ ...prev, test_email: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Chọn Template</label>
              <Select value={testEmailForm.template_id} onValueChange={(val) => setTestEmailForm(prev => ({ ...prev, template_id: val }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn một template" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                Email thử nghiệm sẽ được gửi với dữ liệu mẫu từ template đã chọn.
              </p>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsTestEmailOpen(false)}>
                Hủy
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                <Sparkles className="mr-2 h-4 w-4" />
                Gửi Email Thử
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}