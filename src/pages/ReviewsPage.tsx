// src/pages/ReviewsPage.tsx
"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { RefreshCw, FileText, Star, TrendingUp, MoreHorizontal, X } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"

// Helper Component để hiển thị sao
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
      ))}
    </div>
  )
}

// Định nghĩa kiểu dữ liệu cho một 'review' từ database
interface Review {
  id: string;
  rating: number;
  outcome: string;
  notes: string;
  created_at: string;
  cv_interviews: {
    id: string;
    round: string;
    interviewer: string;
    interview_date: string;
    duration: string;
    location: string;
    format: string;
    cv_candidates: {
      full_name: string;
      cv_jobs: {
        title: string;
      } | null;
    } | null;
  } | null;
}

export function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalReviews: 0, averageRating: 0, recommendationRate: 0 });
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isReratingDialogOpen, setIsReratingDialogOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [newRating, setNewRating] = useState(0);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getReviews();
  }, []);

  async function getReviews() {
    setLoading(true);
    const { data, error } = await supabase
      .from('cv_interview_reviews')
      .select(`
        *,
        cv_interviews (
          *,
          cv_candidates (
            full_name,
            cv_jobs ( title )
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (data) {
      setReviews(data as Review[]);
      const total = data.length;
      const sumOfRatings = data.reduce((sum, review) => sum + review.rating, 0);
      const recommendedCount = data.filter(review => review.outcome === 'Vòng tiếp theo' || review.outcome === 'Đạt').length;
      
      setStats({
        totalReviews: total,
        averageRating: total > 0 ? sumOfRatings / total : 0,
        recommendationRate: total > 0 ? (recommendedCount / total) * 100 : 0,
      });
    }
    if (error) console.error('Error fetching reviews:', error);
    setLoading(false);
  }

  // Hiển thị chi tiết
  const handleViewDetail = (review: Review) => {
    setSelectedReview(review);
    setIsDetailDialogOpen(true);
  };

  // Đánh giá lại
  const handleRerating = (review: Review) => {
    setSelectedReview(review);
    setNewRating(review.rating);
    setNewNote(review.notes || '');
    setIsReratingDialogOpen(true);
  };

  // Submit đánh giá lại
  const handleSubmitRerating = async () => {
    if (!selectedReview || newRating === 0) {
      alert('Vui lòng chọn số sao đánh giá!');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('cv_interview_reviews')
        .update({ 
          rating: newRating,
          notes: newNote
        })
        .eq('id', selectedReview.id);

      if (error) throw error;

      // Refresh data
      await getReviews();

      setIsReratingDialogOpen(false);
      setSelectedReview(null);
      setNewRating(0);
      setNewNote('');
      
      alert('Cập nhật đánh giá thành công!');
    } catch (error) {
      console.error('Error updating rating:', error);
      alert('Có lỗi xảy ra khi cập nhật đánh giá!');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Đánh giá phỏng vấn</h1>
          <p className="text-sm text-muted-foreground">Quản lý và theo dõi đánh giá phỏng vấn</p>
        </div>
        <Button variant="outline" onClick={getReviews}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Làm mới
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tổng số đánh giá</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReviews}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Đánh giá trung bình</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {stats.averageRating.toFixed(1)} 
              <StarRating rating={stats.averageRating} />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tỷ lệ khuyên nghị</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground"/>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recommendationRate.toFixed(0)}%</div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Danh sách đánh giá</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ứng viên</TableHead>
                <TableHead>Vị trí</TableHead>
                <TableHead>Vòng</TableHead>
                <TableHead>Người PV</TableHead>
                <TableHead>Ngày PV</TableHead>
                <TableHead>Đánh giá</TableHead>
                <TableHead>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">Đang tải dữ liệu...</TableCell>
                </TableRow>
              ) : reviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">Chưa có đánh giá nào</TableCell>
                </TableRow>
              ) : (
                reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-medium">{review.cv_interviews?.cv_candidates?.full_name || 'N/A'}</TableCell>
                    <TableCell>{review.cv_interviews?.cv_candidates?.cv_jobs?.title || 'N/A'}</TableCell>
                    <TableCell>{review.cv_interviews?.round || 'N/A'}</TableCell>
                    <TableCell>{review.cv_interviews?.interviewer || 'N/A'}</TableCell>
                    <TableCell>{review.cv_interviews ? new Date(review.cv_interviews.interview_date).toLocaleDateString('vi-VN') : 'N/A'}</TableCell>
                    <TableCell><StarRating rating={review.rating} /></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white" style={{ zIndex: 50 }}>
                          <DropdownMenuItem onClick={() => handleViewDetail(review)}>
                            Hiển thị
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRerating(review)}>
                            Đánh giá lại
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Hiển thị Chi tiết */}
      {isDetailDialogOpen && selectedReview && (
        <>
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            style={{ zIndex: 999999 }}
            onClick={() => setIsDetailDialogOpen(false)}
          />
          
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000000 }}>
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4 pointer-events-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Chi tiết đánh giá phỏng vấn
                </h2>
                <button
                  onClick={() => setIsDetailDialogOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Thông tin ứng viên */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <h3 className="font-semibold text-blue-900 mb-2">Thông tin ứng viên</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-blue-700">Họ tên</p>
                      <p className="font-semibold text-blue-900">{selectedReview.cv_interviews?.cv_candidates?.full_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-700">Vị trí ứng tuyển</p>
                      <p className="font-semibold text-blue-900">{selectedReview.cv_interviews?.cv_candidates?.cv_jobs?.title || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Thông tin buổi phỏng vấn */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Thông tin buổi phỏng vấn</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Vòng phỏng vấn</p>
                      <p className="font-medium text-gray-900">{selectedReview.cv_interviews?.round || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Người phỏng vấn</p>
                      <p className="font-medium text-gray-900">{selectedReview.cv_interviews?.interviewer || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Ngày phỏng vấn</p>
                      <p className="font-medium text-gray-900">
                        {selectedReview.cv_interviews ? new Date(selectedReview.cv_interviews.interview_date).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Thời lượng</p>
                      <p className="font-medium text-gray-900">{selectedReview.cv_interviews?.duration || 'N/A'} phút</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Hình thức</p>
                      <p className="font-medium text-gray-900">{selectedReview.cv_interviews?.format || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Địa điểm</p>
                      <p className="font-medium text-gray-900">{selectedReview.cv_interviews?.location || 'Chưa có thông tin'}</p>
                    </div>
                  </div>
                </div>

                {/* Đánh giá */}
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <h3 className="font-semibold text-yellow-900 mb-3">Đánh giá</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-yellow-700 mb-1">Rating</p>
                      <div className="flex items-center gap-2">
                        <StarRating rating={selectedReview.rating} />
                        <span className="font-bold text-yellow-900 text-lg">{selectedReview.rating}/5</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-yellow-700 mb-1">Kết quả</p>
                      <Badge className={
                        selectedReview.outcome === 'Vòng tiếp theo' ? 'bg-blue-100 text-blue-700' :
                        selectedReview.outcome === 'Đạt' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }>
                        {selectedReview.outcome}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-yellow-700 mb-1">Thời gian đánh giá</p>
                      <p className="font-medium text-yellow-900">
                        {new Date(selectedReview.created_at).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {selectedReview.notes && (
                      <div>
                        <p className="text-sm text-yellow-700 mb-1">Ghi chú</p>
                        <p className="text-yellow-900 bg-white rounded p-3 border border-yellow-200">{selectedReview.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t px-6 py-4 flex justify-end">
                <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Dialog Đánh giá lại */}
      {isReratingDialogOpen && selectedReview && (
        <>
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            style={{ zIndex: 999999 }}
            onClick={() => {
              setIsReratingDialogOpen(false);
              setNewRating(0);
              setNewNote('');
            }}
          />
          
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000000 }}>
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 pointer-events-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Đánh giá lại buổi phỏng vấn
                </h2>
                <button
                  onClick={() => {
                    setIsReratingDialogOpen(false);
                    setNewRating(0);
                    setNewNote('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Thông tin ứng viên */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Ứng viên</p>
                  <p className="font-semibold text-lg">{selectedReview.cv_interviews?.cv_candidates?.full_name}</p>
                  <p className="text-sm text-gray-600 mt-1">{selectedReview.cv_interviews?.cv_candidates?.cv_jobs?.title}</p>
                </div>

                {/* Đánh giá hiện tại */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-blue-700 mb-2">Đánh giá hiện tại</p>
                  <div className="flex items-center gap-2 mb-3">
                    <StarRating rating={selectedReview.rating} />
                    <span className="font-bold text-blue-900">{selectedReview.rating}/5</span>
                  </div>
                  {selectedReview.notes && (
                    <div>
                      <p className="text-sm text-blue-700 mb-1">Ghi chú cũ</p>
                      <p className="text-sm text-blue-900 bg-white rounded p-2 border border-blue-200">{selectedReview.notes}</p>
                    </div>
                  )}
                </div>

                {/* Rating mới */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Đánh giá mới <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star 
                          className={`w-10 h-10 ${
                            star <= newRating 
                              ? 'fill-yellow-400 text-yellow-400' 
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-lg font-semibold text-gray-700">
                      {newRating > 0 ? `${newRating}/5` : 'Chưa chọn'}
                    </span>
                  </div>
                </div>

                {/* Ghi chú mới */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Ghi chú đánh giá
                  </label>
                  <Textarea
                    placeholder="Nhập ghi chú về đánh giá của bạn (ví dụ: kỹ năng cần cải thiện, điểm mạnh, lý do thay đổi đánh giá...)"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={5}
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-500">
                    {newNote.length}/500 ký tự
                  </p>
                </div>
              </div>

              <div className="border-t px-6 py-4 flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsReratingDialogOpen(false);
                    setNewRating(0);
                    setNewNote('');
                  }}
                  disabled={submitting}
                >
                  Hủy
                </Button>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSubmitRerating}
                  disabled={submitting || newRating === 0}
                >
                  <Star className="w-4 h-4 mr-2" />
                  {submitting ? 'Đang lưu...' : 'Cập nhật đánh giá'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}