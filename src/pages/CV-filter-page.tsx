"use client"

import * as React from "react"
// ✅ Dùng react-router-dom cho Vite
import { useNavigate } from "react-router-dom"
import {
  RefreshCw,
  Brain,
  Users,
  Download,
  Eye,
  CheckCircle,
  AlertCircle,
  Target,
  Sparkles,
  Briefcase,
  RotateCcw,
  Calendar, // ✅ Đã import icon Calendar
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// ==================== TOAST ====================
const useToast = () => {
  const toast = React.useCallback((options: { title: string; description: string; duration: number }) => {
    alert(`${options.title}\n${options.description}`)
  }, []);
  return { toast };
}

// ==================== SIMPLE PROGRESS BAR COMPONENT ====================
const Progress = ({ value, className = "" }: { value: number; className?: string }) => {
  return (
    <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${className}`}>
      <div
        className="bg-blue-600 h-full transition-all duration-300"
        style={{ width: `${value}%` }}
      />
    </div>
  );
};

// ==================== OPENROUTER GPT-4O SERVICE ====================
interface JobMatchResult {
  job_id: string
  job_title: string
  match_score: number
  strengths: string[]
  weaknesses: string[]
  recommendation: string
}

interface CVAnalysisResult {
  overall_score: number
  best_match: JobMatchResult | null
  all_matches: JobMatchResult[]
}

async function analyzeWithGPT4o(
  cvText: string,
  cvData: any,
  jobs: any[],
  primaryJobId?: string
): Promise<CVAnalysisResult> {
  try {
    console.log('🎯 Calling backend to match CV with jobs...');
    
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    
    const response = await fetch(`${API_URL}/api/match-cv-jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cv_text: cvText,
        cv_data: {
          full_name: cvData.full_name,
          email: cvData.email,
          phone_number: cvData.phone_number,
          address: cvData.address,
          university: cvData.university,
          education: cvData.education,
          experience: cvData.experience,
        },
        jobs: jobs.map((job: any) => ({
          id: job.id,
          title: job.title,
          department: job.department,
          level: job.level,
          job_type: job.job_type,
          work_location: job.work_location,
          location: job.location,
          description: job.description,
          requirements: job.requirements,
          benefits: job.benefits,
          mandatory_requirements: job.mandatory_requirements || null,
        })),
        primary_job_id: primaryJobId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Backend error:', errorData);
      throw new Error(errorData.detail || `Backend error: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ AI matching analysis thành công');

    if (result.success && result.data) {
      return result.data as CVAnalysisResult;
    }

    throw new Error('Backend không trả về dữ liệu hợp lệ');

  } catch (error) {
    console.error('❌ Lỗi khi gọi backend:', error);
    throw error;
  }
}

// ==================== HELPER FUNCTIONS ====================
const getScoreColor = (score: number) => {
  if (score >= 85) return "text-green-600"
  if (score >= 70) return "text-blue-600"
  if (score >= 50) return "text-yellow-600"
  return "text-red-600"
}

const getScoreBg = (score: number) => {
  if (score >= 85) return "bg-green-50 border-green-200"
  if (score >= 70) return "bg-blue-50 border-blue-200"
  if (score >= 50) return "bg-yellow-50 border-yellow-200"
  return "bg-red-50 border-red-200"
}

// ==================== MAIN COMPONENT ====================
export default function PotentialCandidatesPage() {
  const { toast } = useToast()
  // ✅ Khởi tạo hook navigate
  const navigate = useNavigate()
  
  const [loading, setLoading] = React.useState(true)
  const [analyzing, setAnalyzing] = React.useState(false)
  const [reanalyzingId, setReanalyzingId] = React.useState<string | null>(null)
  const [candidates, setCandidates] = React.useState<any[]>([])
  const [jobs, setJobs] = React.useState<any[]>([])
  const [selectedJob, setSelectedJob] = React.useState<string>("all")
  const [showDetail, setShowDetail] = React.useState(false)
  const [selectedCandidate, setSelectedCandidate] = React.useState<any>(null)

  React.useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data: jobsData, error: jobsError } = await supabase
        .from("cv_jobs")
        .select("*")
        .order("title")

      if (jobsError) throw jobsError
      setJobs(jobsData || [])

      const { data: candidatesData, error: candidatesError } = await supabase
        .from("cv_candidates")
        .select(`
          *,
          cv_jobs (
            id,
            title,
            level,
            department,
            description,
            requirements,
            benefits,
            mandatory_requirements,
            job_type,
            work_location,
            location
          ),
          cv_candidate_skills (
            cv_skills (
              id,
              name,
              category
            )
          )
        `)
        .not("cv_parsed_data", "is", null)
        .order("created_at", { ascending: false })

      if (candidatesError) throw candidatesError

      const parsedCandidates = (candidatesData || []).map((c: any) => ({
        ...c,
        analysis_result: c.cv_parsed_data?.analysis_result || null,
        overall_score: c.cv_parsed_data?.analysis_result?.overall_score || 0,
      }))

      setCandidates(parsedCandidates)

    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu",
        duration: 3000,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyzeAll = async () => {
    try {
      setAnalyzing(true)

      const candidatesToAnalyze = candidates.filter(
        (c) => !c.analysis_result && c.cv_parsed_data
      )

      if (candidatesToAnalyze.length === 0) {
        toast({
          title: "Thông báo",
          description: "Tất cả CV đã được phân tích",
          duration: 3000,
        })
        return
      }

      let successCount = 0

      for (const candidate of candidatesToAnalyze) {
        try {
          const cvText = candidate.cv_parsed_data?.fullText || ""
          const cvData = {
            full_name: candidate.full_name,
            email: candidate.email,
            phone_number: candidate.phone_number,
            address: candidate.address,
            university: candidate.university,
            education: candidate.education,
            experience: candidate.experience,
          }

          const analysisResult = await analyzeWithGPT4o(
            cvText,
            cvData,
            jobs,
            candidate.job_id
          )

          const updatedParsedData = {
            ...candidate.cv_parsed_data,
            analysis_result: analysisResult,
          }

          // ✅ Tự động chuyển sang "Sàng lọc" nếu đang là "Mới"
          const newStatus = candidate.status === 'Mới' ? 'Sàng lọc' : candidate.status;

          const { error } = await supabase
            .from("cv_candidates")
            .update({ 
              cv_parsed_data: updatedParsedData,
              status: newStatus 
            })
            .eq("id", candidate.id)

          if (error) throw error

          successCount++
        } catch (error) {
          console.error(`Error analyzing candidate ${candidate.id}:`, error)
        }
      }

      toast({
        title: "Hoàn thành",
        description: `Phân tích thành công ${successCount}/${candidatesToAnalyze.length} CV. Các ứng viên đã được chuyển sang trạng thái "Sàng lọc".`,
        duration: 3000,
      })

      await fetchData()

    } catch (error) {
      console.error("Error analyzing candidates:", error)
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi phân tích",
        duration: 3000,
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleAnalyzeOne = async (candidate: any) => {
    try {
      if (!candidate.cv_parsed_data) {
        toast({
          title: "Lỗi",
          description: "CV chưa được parse",
          duration: 3000,
        })
        return
      }

      setAnalyzing(true)

      const cvText = candidate.cv_parsed_data?.fullText || ""
      const cvData = {
        full_name: candidate.full_name,
        email: candidate.email,
        phone_number: candidate.phone_number,
        address: candidate.address,
        university: candidate.university,
        education: candidate.education,
        experience: candidate.experience,
      }

      const analysisResult = await analyzeWithGPT4o(
        cvText,
        cvData,
        jobs,
        candidate.job_id
      )

      const updatedParsedData = {
        ...candidate.cv_parsed_data,
        analysis_result: analysisResult,
      }

      // ✅ Tự động chuyển sang "Sàng lọc" nếu đang là "Mới"
      const newStatus = candidate.status === 'Mới' ? 'Sàng lọc' : candidate.status;

      const { error } = await supabase
        .from("cv_candidates")
        .update({ 
          cv_parsed_data: updatedParsedData,
          status: newStatus 
        })
        .eq("id", candidate.id)

      if (error) throw error

      toast({
        title: "Thành công",
        description: newStatus === 'Sàng lọc' 
          ? "Phân tích CV hoàn tất. Ứng viên đã được chuyển sang trạng thái 'Sàng lọc'."
          : "Phân tích CV hoàn tất.",
        duration: 3000,
      })

      await fetchData()

    } catch (error) {
      console.error("Error analyzing candidate:", error)
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra khi phân tích",
        duration: 3000,
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleReanalyze = async (candidate: any) => {
    try {
      if (!candidate.cv_parsed_data) {
        toast({
          title: "Lỗi",
          description: "CV chưa được parse",
          duration: 3000,
        })
        return
      }

      setReanalyzingId(candidate.id)

      console.log('🔄 RE-ANALYZING candidate:', candidate.full_name);

      const cvText = candidate.cv_parsed_data?.fullText || ""
      const cvData = {
        full_name: candidate.full_name,
        email: candidate.email,
        phone_number: candidate.phone_number,
        address: candidate.address,
        university: candidate.university,
        education: candidate.education,
        experience: candidate.experience,
      }

      const analysisResult = await analyzeWithGPT4o(
        cvText,
        cvData,
        jobs,
        candidate.job_id
      )

      const updatedParsedData = {
        ...candidate.cv_parsed_data,
        analysis_result: analysisResult,
      }

      // ✅ Nếu phân tích lại, cũng kiểm tra trạng thái "Mới" để chuyển
      const newStatus = candidate.status === 'Mới' ? 'Sàng lọc' : candidate.status;

      const { error } = await supabase
        .from("cv_candidates")
        .update({ 
          cv_parsed_data: updatedParsedData,
          status: newStatus
        })
        .eq("id", candidate.id)

      if (error) throw error

      toast({
        title: "Phân tích lại thành công",
        description: `${candidate.full_name} - Điểm mới: ${analysisResult.overall_score}`,
        duration: 3000,
      })

      await fetchData()

    } catch (error) {
      console.error("Error re-analyzing candidate:", error)
      toast({
        title: "Lỗi phân tích lại",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra",
        duration: 3000,
      })
    } finally {
      setReanalyzingId(null)
    }
  }

  const handleViewDetail = (candidate: any) => {
    setSelectedCandidate(candidate)
    setShowDetail(true)
  }

  // ✅ Hàm chuyển hướng đến trang phỏng vấn sử dụng navigate
  const handleCreateInterview = (candidate: any) => {
  navigate(`/phong-van?create=true&candidateId=${candidate.id}`);
  };

  const filteredCandidates = React.useMemo(() => {
    return candidates.filter((c) => {
      if (selectedJob !== "all" && c.job_id !== selectedJob) return false
      return true
    })
  }, [candidates, selectedJob])

  // Stats
  const stats = React.useMemo(() => {
    const total = filteredCandidates.length
    const analyzed = filteredCandidates.filter((c) => c.analysis_result).length
    const excellent = filteredCandidates.filter((c) => c.overall_score >= 85).length
    const avgScore = analyzed > 0
      ? Math.round(
          filteredCandidates
            .filter((c) => c.analysis_result)
            .reduce((sum, c) => sum + c.overall_score, 0) / analyzed
        )
      : 0

    return { total, analyzed, excellent, avgScore }
  }, [filteredCandidates])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Brain className="h-8 w-8 text-blue-600" />
            Ứng viên tiềm năng
          </h1>
          <p className="text-gray-600 mt-1">
            Phân tích và đánh giá độ phù hợp của CV với các vị trí tuyển dụng
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={fetchData} disabled={analyzing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${analyzing ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
          <Button onClick={handleAnalyzeAll} disabled={analyzing}>
            <Sparkles className="h-4 w-4 mr-2" />
            {analyzing ? "Đang phân tích..." : "Phân tích tất cả"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2 border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Tổng số CV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Đã phân tích
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.analyzed}</div>
          </CardContent>
        </Card>

        <Card className="border-2 border-yellow-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Điểm TB
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats.avgScore}</div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Xuất sắc (≥85)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.excellent}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Lọc theo vị trí
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
            >
              <option value="all">Tất cả vị trí</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} - {job.level}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCandidates.map((candidate) => (
          <Card
            key={candidate.id}
            className={`hover:shadow-lg transition-all ${
              candidate.analysis_result ? getScoreBg(candidate.overall_score) : "bg-gray-50"
            }`}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">
                    {candidate.full_name}
                  </h3>
                  <p className="text-sm text-gray-600">{candidate.email}</p>
                  {candidate.cv_jobs && (
                    <Badge variant="outline" className="mt-2">
                      {candidate.cv_jobs.title}
                    </Badge>
                  )}
                  {candidate.status === 'Sàng lọc' && (
                     <Badge className="ml-2 bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">Sàng lọc</Badge>
                  )}
                </div>
                {candidate.analysis_result && (
                  <div className={`text-2xl font-bold ${getScoreColor(candidate.overall_score)}`}>
                    {candidate.overall_score}
                  </div>
                )}
              </div>

              {candidate.analysis_result?.best_match && (
                <div className="bg-white/50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-600 mb-1">Best match:</p>
                  <p className="text-sm font-medium text-gray-900">
                    {candidate.analysis_result.best_match.job_title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {candidate.cv_jobs?.id === candidate.analysis_result.best_match.job_id
                      ? "✅ Đây là vị trí phù hợp nhất"
                      : "💡 Gợi ý vị trí phù hợp nhất"}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                      {candidate.analysis_result.best_match.match_score}% match
                    </Badge>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {!candidate.analysis_result ? (
                  <Button
                    size="sm"
                    onClick={() => handleAnalyzeOne(candidate)}
                    disabled={analyzing}
                    className="w-full"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Phân tích
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDetail(candidate)}
                      className="w-full"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Xem chi tiết
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleReanalyze(candidate)}
                      disabled={reanalyzingId === candidate.id}
                      className="w-full"
                    >
                      {reanalyzingId === candidate.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Đang phân tích...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Phân tích lại
                        </>
                      )}
                    </Button>

                    {/* ✅ Button Tạo lịch phỏng vấn */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCreateInterview(candidate)}
                      className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Tạo lịch phỏng vấn
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCandidates.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Không tìm thấy ứng viên
            </h3>
            <p className="text-gray-600">
              Thử điều chỉnh bộ lọc để xem thêm ứng viên
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedCandidate?.full_name}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedCandidate?.email}
                  </p>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedCandidate && (
            <div className="p-6 space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Điểm tổng thể
                  </h4>
                  <span className={`text-2xl font-bold ${getScoreColor(selectedCandidate.overall_score || 0)}`}>
                    {selectedCandidate.overall_score || 0}/100
                  </span>
                </div>
                <Progress value={selectedCandidate.overall_score || 0} className="h-3" />
              </div>

              {selectedCandidate.analysis_result?.best_match && (
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5 rounded-xl border border-emerald-200">
                  <h4 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Công việc phù hợp nhất
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-lg text-emerald-900">
                        {selectedCandidate.analysis_result.best_match.job_title}
                      </p>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                        {selectedCandidate.analysis_result.best_match.match_score}% match
                      </Badge>
                    </div>
                    <p className="text-sm text-emerald-600">
                      {selectedCandidate.cv_jobs?.id === selectedCandidate.analysis_result.best_match.job_id
                        ? "✅ Đây là vị trí phù hợp nhất"
                        : "💡 Gợi ý vị trí phù hợp nhất"}
                    </p>
                    <p className="text-sm text-emerald-800">
                      {selectedCandidate.analysis_result.best_match.recommendation}
                    </p>
                  </div>
                </div>
              )}

              {selectedCandidate.analysis_result?.all_matches && (
                <Tabs defaultValue="strengths" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="strengths">Điểm mạnh</TabsTrigger>
                    <TabsTrigger value="weaknesses">Điểm yếu</TabsTrigger>
                    <TabsTrigger value="matches">Gợi ý Matches khác</TabsTrigger>
                  </TabsList>

                  <TabsContent value="strengths" className="space-y-3">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5 rounded-xl border border-emerald-200">
                      <h4 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Điểm mạnh
                      </h4>
                      <ul className="space-y-2">
                        {selectedCandidate.analysis_result.best_match?.strengths?.map((strength: string, index: number) => (
                          <li key={index} className="text-sm flex items-start gap-2 text-emerald-800">
                            <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                            {strength}
                          </li>
                        ))}
                        {(!selectedCandidate.analysis_result.best_match?.strengths || 
                          selectedCandidate.analysis_result.best_match.strengths.length === 0) && (
                          <p className="text-sm text-gray-500">Không có thông tin điểm mạnh</p>
                        )}
                      </ul>
                    </div>
                  </TabsContent>

                  <TabsContent value="weaknesses" className="space-y-3">
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-5 rounded-xl border border-amber-200">
                      <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Điểm yếu
                      </h4>
                      <ul className="space-y-2">
                        {selectedCandidate.analysis_result.best_match?.weaknesses?.map((weakness: string, index: number) => (
                          <li key={index} className="text-sm flex items-start gap-2 text-amber-800">
                            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            {weakness}
                          </li>
                        ))}
                        {(!selectedCandidate.analysis_result.best_match?.weaknesses || 
                          selectedCandidate.analysis_result.best_match.weaknesses.length === 0) && (
                          <p className="text-sm text-gray-500">Không có thông tin điểm yếu</p>
                        )}
                      </ul>
                    </div>
                  </TabsContent>

                  <TabsContent value="matches" className="space-y-3">
                    {selectedCandidate.analysis_result?.all_matches && selectedCandidate.analysis_result.all_matches.length > 0 ? (
                      <>
                        {(() => {
                          const suggestedMatches = selectedCandidate.analysis_result.all_matches
                            .filter((match: JobMatchResult) => match.job_id !== selectedCandidate.cv_jobs?.id)
                            .slice(0, 3);

                          return suggestedMatches.length > 0 ? (
                            <>
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                <p className="text-sm text-blue-800">
                                  <span className="font-semibold">💡 Gợi ý {suggestedMatches.length} vị trí phù hợp khác:</span>
                                </p>
                              </div>
                              {suggestedMatches.map((match: JobMatchResult, index: number) => (
                                <Card
                                  key={index}
                                  className={`${getScoreBg(match.match_score)} border-2`}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <h5 className="font-semibold text-gray-900">{match.job_title}</h5>
                                      <Badge className={`${getScoreBg(match.match_score)}`}>
                                        <span className={`font-bold ${getScoreColor(match.match_score)}`}>
                                          {match.match_score}%
                                        </span>
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-700 mb-3">{match.recommendation}</p>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-xs font-medium text-gray-500 mb-2">Điểm mạnh:</p>
                                        <ul className="space-y-1">
                                          {match.strengths?.slice(0, 3).map((s, i) => (
                                            <li key={i} className="text-xs text-gray-700 flex items-start gap-1">
                                              <CheckCircle className="h-3 w-3 text-emerald-600 mt-0.5 flex-shrink-0" />
                                              {s}
                                            </li>
                                          ))}
                                          {(!match.strengths || match.strengths.length === 0) && (
                                            <p className="text-xs text-gray-500">N/A</p>
                                          )}
                                        </ul>
                                      </div>
                                      <div>
                                        <p className="text-xs font-medium text-gray-500 mb-2">Điểm yếu:</p>
                                        <ul className="space-y-1">
                                          {match.weaknesses?.slice(0, 2).map((w, i) => (
                                            <li key={i} className="text-xs text-gray-700 flex items-start gap-1">
                                              <AlertCircle className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
                                              {w}
                                            </li>
                                          ))}
                                          {(!match.weaknesses || match.weaknesses.length === 0) && (
                                            <p className="text-xs text-gray-500">N/A</p>
                                          )}
                                        </ul>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </>
                          ) : (
                            <div className="text-center py-8">
                              <p className="text-gray-500">Không có gợi ý vị trí nào khác phù hợp hơn</p>
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-500">Không có dữ liệu matching</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}

              <div className="grid grid-cols-2 gap-4 p-5 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Trường</p>
                  <p className="text-sm font-medium text-gray-900">{selectedCandidate.university || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Học vấn</p>
                  <p className="text-sm font-medium text-gray-900">{selectedCandidate.education || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Kinh nghiệm</p>
                  <p className="text-sm font-medium text-gray-900">{selectedCandidate.experience || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Địa chỉ</p>
                  <p className="text-sm font-medium text-gray-900">{selectedCandidate.address || "N/A"}</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button variant="outline" onClick={() => setShowDetail(false)}>
                  Đóng
                </Button>
                {selectedCandidate.cv_url && (
                  <Button
                    onClick={() => window.open(selectedCandidate.cv_url, "_blank")}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Tải CV gốc
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}