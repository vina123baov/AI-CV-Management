// src/pages/InterviewsPage.tsx
"use client"

import { useState, useEffect } from "react"
// Đã thêm import Pencil
import { Plus, Calendar, Clock, CheckCircle, XCircle, MoreHorizontal, Search, User, Briefcase, MapPin, Video, X, Star, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabaseClient"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CandidateAutoCompleteDual } from "@/components/CandidateAutoCompleteDual"

// --- Interfaces ---

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  job_id?: string;
  cv_jobs?: {
    id: string;
    title: string;
    level: string;
  } | null;
}

interface Interview {
  id: string;
  interview_date: string;
  interviewer: string;
  round: string;
  format: string;
  status: string;
  duration: string;
  location: string;
  //end_time?: string;
  cv_candidates: {
    full_name: string;
    cv_jobs: {
      id: string;
      title: string;
    } | null;
  } | null;
}

export function InterviewsPage() {
  // --- States ---
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  
  // Dialog States
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  // State mới cho Dialog Chỉnh sửa
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReviewFormDialogOpen, setIsReviewFormDialogOpen] = useState(false);
  // Data States
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [reviewData, setReviewData] = useState({
    rating: 0,
    notes: '',
    outcome: 'Vòng tiếp theo'
  });
  const [interviewToReview, setInterviewToReview] = useState<Interview | null>(null);
  // Form state (Create)
  const [formData, setFormData] = useState({
    candidate_id: "",
    job_id: "",
    round: "",
    interview_date: "",
    interview_time: "",
    duration: "60",
    location: "",
    format: "Trực tiếp",
    interviewer: "",
    notes: ""
  });

  // Form state (Edit) - MỚI THÊM
  const [editFormData, setEditFormData] = useState({
    id: "",
    job_id: "",
    round: "",
    interview_date: "",
    interview_time: "",
    duration: "",
    location: "",
    format: "",
    interviewer: "",
    candidate_name: "" // Chỉ để hiển thị
  });

  // Form errors state
  const [formErrors, setFormErrors] = useState({
    interview_date: "",
    interview_time: "",
    duration: ""
  });

  // --- Logic & Helpers ---

  // V1 Logic: Tự động tính trạng thái dựa trên thời gian
  const getInterviewStatus = (interview: Interview) => {
    const now = new Date();
    const interviewStart = new Date(interview.interview_date);

    // Nếu trạng thái đã là các trạng thái "kết thúc", giữ nguyên
    if (
  interview.status === 'Hoàn thành' || 
  interview.status === 'Đã hủy' || 
  interview.status === 'Đang đánh giá' ||
  interview.status === 'Đang chờ đánh giá'  // ← THÊM DÒNG NÀY
  ) {
    return interview.status;
  }

    const isToday = interviewStart.toDateString() === now.toDateString();
    const isPast = interviewStart < now;

    if (isToday && !isPast) {
      return 'Đang phỏng vấn';
    } else if (isPast) {
      const durationMinutes = parseInt(interview.duration) || 60;
      const expectedEndTime = new Date(interviewStart.getTime() + durationMinutes * 60000);

      if (now <= expectedEndTime) {
        return 'Đang phỏng vấn';
      } else {
      // Chỉ tự động chuyển thành "Đang chờ đánh giá" nếu status = "Đang chờ"
        return interview.status === 'Đang chờ' ? 'Đang chờ đánh giá' : interview.status;
      }
    } else {
      return 'Đang chờ';
    }
  };

  // ✅ ADDED FROM V2: Xử lý URL Params để mở dialog tự động
  useEffect(() => {
    const initFromUrl = async () => {
      const params = new URLSearchParams(window.location.search);
      const createMode = params.get('create');
      const candidateId = params.get('candidateId');

      if (createMode === 'true') {
        setIsDialogOpen(true);
        
        if (candidateId) {
          // 1. Set ID vào form
          setFormData(prev => ({
            ...prev,
            candidate_id: candidateId
          }));

          // 2. Fetch thông tin chi tiết ứng viên
          const { data: candidateData } = await supabase
            .from('cv_candidates')
            .select(`
              id, 
              full_name, 
              email,
              cv_jobs!job_id ( id, title, level )
            `)
            .eq('id', candidateId)
            .single();

          if (candidateData) {
            const rawCvJobs = candidateData.cv_jobs as any;
            const jobData = Array.isArray(rawCvJobs) ? rawCvJobs[0] : rawCvJobs;

            const formattedCandidate: Candidate = {
              id: candidateData.id,
              full_name: candidateData.full_name,
              email: candidateData.email,
              job_id: jobData?.id,
              cv_jobs: jobData
            };

            setSelectedCandidate(formattedCandidate);

            // Auto-fill form fields
            setFormData(prev => ({
              ...prev,
              job_id: jobData?.id || ""
            }));
          }
        }
        
        // Xóa params để tránh mở lại khi F5
        window.history.replaceState({}, '', '/phong-van');
      }
    };

    initFromUrl();
  }, []);

  // Load danh sách interviews
  useEffect(() => {
    async function getInterviews() {
      setLoading(true);
      const { data, error } = await supabase
        .from('cv_interviews')
        .select(`
          *,
          cv_candidates!candidate_id (
            full_name,
            cv_jobs!job_id ( id, title )
          )
        `)
        .order('interview_date', { ascending: false });

      if (data) {
        // Cập nhật trạng thái realtime (V1 logic)
        const updatedInterviews = data.map(interview => ({
          ...interview,
          status: getInterviewStatus(interview as Interview)
        }));
        setInterviews(updatedInterviews as Interview[]);
      }
      if (error) {
        console.error('Error fetching interviews:', error);
      }
      setLoading(false);
    }
    getInterviews();
  }, []);

  // Load candidates và jobs cho form
  useEffect(() => {
    async function loadFormData() {
      const { data: candidatesData } = await supabase
        .from('cv_candidates')
        .select('id, full_name, cv_jobs!job_id(title)')
        .order('full_name');
      
      const { data: jobsData } = await supabase
        .from('cv_jobs')
        .select('id, title')
        .order('title');

      if (candidatesData) setCandidates(candidatesData);
      if (jobsData) setJobs(jobsData);
    }
    loadFormData();
  }, []);

  // Handle candidate selection (V1 Logic)
  const handleCandidateSelect = (candidate: Candidate | null) => {
    setSelectedCandidate(candidate);

    if (candidate) {
      setFormData(prev => ({
        ...prev,
        candidate_id: candidate.id,
        job_id: candidate.cv_jobs?.id || ""
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        candidate_id: "",
        job_id: ""
      }));
    }
  };

  
  // Validate form (V1 Logic)
  const validateInterviewDateTime = () => {
    const errors = {
      interview_date: "",
      interview_time: "",
      duration: ""
    };

    if (!formData.interview_date) {
      errors.interview_date = "Vui lòng chọn ngày phỏng vấn";
      setFormErrors(errors);
      return false;
    }

    if (!formData.interview_time) {
      errors.interview_time = "Vui lòng chọn giờ phỏng vấn";
      setFormErrors(errors);
      return false;
    }

    const duration = parseInt(formData.duration);
    if (!duration || duration < 5) {
      errors.duration = "Thời lượng phỏng vấn tối thiểu là 5 phút";
      setFormErrors(errors);
      return false;
    }

    const interviewDateTime = new Date(`${formData.interview_date}T${formData.interview_time}`);
    const now = new Date();

    if (isNaN(interviewDateTime.getTime())) {
      errors.interview_date = "Ngày và giờ phỏng vấn không hợp lệ";
      setFormErrors(errors);
      return false;
    }

    if (interviewDateTime <= now) {
      errors.interview_date = "Ngày và giờ phỏng vấn phải là thời điểm trong tương lai";
      errors.interview_time = "Ngày và giờ phỏng vấn phải là thời điểm trong tương lai";
      setFormErrors(errors);
      return false;
    }

    setFormErrors(errors);
    return true;
  };

  // --- Actions ---

  // Tạo mới (Submit Form)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateInterviewDateTime()) {
      return;
    }

    setSubmitting(true);

    try {
      const interviewDateTime = `${formData.interview_date}T${formData.interview_time}:00`;

      let interviewData: any = {
        interview_date: interviewDateTime,
        interviewer: formData.interviewer,
        round: formData.round,
        format: formData.format,
        status: 'Đang chờ',
        duration: formData.duration,
        location: formData.location,
        notes: formData.notes
      };

      // Use candidate_id if exists, otherwise use name/email directly
      if (formData.candidate_id) {
        interviewData.candidate_id = formData.candidate_id;
      }

      const { data, error } = await supabase
        .from('cv_interviews')
        .insert([interviewData])
        .select();

      if (error) throw error;

      if (formData.candidate_id) {
        const { error: updateError } = await supabase
          .from('cv_candidates')
          .update({ status: 'Phỏng vấn' })
          .eq('id', formData.candidate_id);
        
        if (updateError) {
           console.error('Lỗi tự động cập nhật trạng thái ứng viên:', updateError);
        }
      }

      // Refresh list
      const { data: updatedInterviews } = await supabase
        .from('cv_interviews')
        .select(`
          *,
          cv_candidates!candidate_id (
            full_name,
            cv_jobs!job_id ( id, title )
          )
        `)
        .order('interview_date', { ascending: false });

      if (updatedInterviews) {
        setInterviews(updatedInterviews.map(i => ({...i, status: getInterviewStatus(i as Interview)})) as Interview[]);
      }

      // Reset form
      setFormData({
        candidate_id: "",
        job_id: "",
        round: "",
        interview_date: "",
        interview_time: "",
        duration: "60",
        location: "",
        format: "Trực tiếp",
        interviewer: "",
        notes: ""
      });
      setFormErrors({ interview_date: "", interview_time: "", duration: "" });
      setSelectedCandidate(null);
      setIsDialogOpen(false);

      alert('Tạo lịch phỏng vấn thành công!');
    } catch (error) {
      console.error('Error creating interview:', error);
      alert('Có lỗi xảy ra khi tạo lịch phỏng vấn!');
    } finally {
      setSubmitting(false);
    }
  };

  // Xem chi tiết
  const handleViewDetail = (interview: Interview) => {
    setSelectedInterview(interview);
    setIsDetailDialogOpen(true);
  };

  // Kết thúc sớm (V1 Logic)
  const handleEndInterview = async (interview: Interview) => {
    if (!confirm(`Bạn có chắc muốn kết thúc sớm buổi phỏng vấn với ${interview.cv_candidates?.full_name}?`)) {
      return;
    }

    setSubmitting(true);
    try {
      
      const { error } = await supabase
        .from('cv_interviews')
        .update({
          status: 'Đang đánh giá'
        })
        .eq('id', interview.id);

      if (error) throw error;
      
      // Update local state quickly
      setInterviews(prev => prev.map(i => i.id === interview.id ? { ...i, status: 'Đang đánh giá' } : i));

      alert('Buổi phỏng vấn đã được kết thúc và chuyển sang trạng thái chờ đánh giá!');
    } catch (error) {
      console.error('Error ending interview:', error);
      alert('Có lỗi xảy ra khi kết thúc buổi phỏng vấn!');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit đánh giá
  const handleSubmitReview = async () => {
    if (!selectedInterview || reviewData.rating === 0) {
      alert('Vui lòng chọn số sao đánh giá!');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from('cv_interviews')
        .update({ status: 'Hoàn thành' })
        .eq('id', selectedInterview.id);

      if (updateError) throw updateError;

      const { error: reviewError } = await supabase
        .from('cv_interview_reviews')
        .insert([{
          interview_id: selectedInterview.id,
          rating: reviewData.rating,
          notes: reviewData.notes,
          outcome: reviewData.outcome
        }]);

      if (reviewError) throw reviewError;

      // Update local state
      setInterviews(prev => prev.map(i => i.id === selectedInterview.id ? { ...i, status: 'Hoàn thành' } : i));

      setReviewData({ rating: 0, notes: '', outcome: 'Vòng tiếp theo' });
      setIsReviewDialogOpen(false);
      setSelectedInterview(null);
      
      alert('Đánh giá đã được lưu thành công!');
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Có lỗi xảy ra khi lưu đánh giá!');
    } finally {
      setSubmitting(false);
    }
  };

  // Hủy lịch
  const handleDelete = async (interview: Interview) => {
    if (!confirm(`Bạn có chắc muốn hủy lịch phỏng vấn với ${interview.cv_candidates?.full_name}?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('cv_interviews')
        .delete()
        .eq('id', interview.id);

      if (error) throw error;

      setInterviews(prev => prev.filter(i => i.id !== interview.id));

      alert('Đã hủy lịch phỏng vấn thành công!');
    } catch (error) {
      console.error('Error deleting interview:', error);
      alert('Có lỗi xảy ra khi hủy lịch phỏng vấn!');
    } finally {
      setSubmitting(false);
    }
  };

  // --- ACTIONS CHO CHỨC NĂNG EDIT (MỚI THÊM) ---

  // Action 1: Mở dialog Edit và điền dữ liệu
  const handleEditClick = (interview: Interview) => {
    // Parse date/time từ interview_date (ISO string)
    const dt = new Date(interview.interview_date);
    // Chuyển đổi sang string cho input date (YYYY-MM-DD) và time (HH:mm)
    // Lưu ý: getMonth() trả về 0-11
    const dateStr = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    const timeStr = String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');

    // Tìm job_id hiện tại của ứng viên (hoặc của interview nếu DB lưu)
    // Ưu tiên lấy từ job hiện tại của candidate nếu trong interview không lưu job_id
    const currentJobId = interview.cv_candidates?.cv_jobs?.id || "";

    setEditFormData({
      id: interview.id,
      job_id: currentJobId,
      round: interview.round,
      interview_date: dateStr,
      interview_time: timeStr,
      duration: interview.duration,
      location: interview.location,
      format: interview.format,
      interviewer: interview.interviewer,
      candidate_name: interview.cv_candidates?.full_name || "Ứng viên"
    });
    
    // Clear errors cũ nếu có
    setFormErrors({ interview_date: "", interview_time: "", duration: "" });
    setIsEditDialogOpen(true);
  };

  // Action 2: Submit Update
  const handleUpdate = async (e: React.FormEvent) => {
   e.preventDefault();

  // Validate
  const errors = { interview_date: "", interview_time: "", duration: "" };
  if (!editFormData.interview_date) errors.interview_date = "Vui lòng chọn ngày";
  if (!editFormData.interview_time) errors.interview_time = "Vui lòng chọn giờ";
  const duration = parseInt(editFormData.duration);
  if (!duration || duration < 5) errors.duration = "Tối thiểu 5 phút";
  
  // ✅ FIX: Tạo Date object từ local time
  const interviewDateTime = new Date(`${editFormData.interview_date}T${editFormData.interview_time}:00`);
  const now = new Date();
  
  // Validate ngày giờ phải hợp lệ
  if (isNaN(interviewDateTime.getTime())) {
    errors.interview_date = "Ngày giờ không hợp lệ";
  }
  
  // Logic: Khi edit, nếu dời lịch thì cũng phải là tương lai
  if (interviewDateTime <= now) {
    errors.interview_date = "Thời gian cập nhật phải ở tương lai";
    errors.interview_time = "Thời gian cập nhật phải ở tương lai";
  }

  if (errors.interview_date || errors.interview_time || errors.duration) {
    setFormErrors(errors);
    return;
  }

  setSubmitting(true);
  try {
    // ✅ FIX CHÍNH: Convert sang ISO string với timezone
    const isoDateTimeString = interviewDateTime.toISOString();
    
    console.log('🔍 Debug - Interview ID:', editFormData.id);
    console.log('🔍 Debug - ISO DateTime:', isoDateTimeString);

    // Object update
    const updatePayload: any = {
      round: editFormData.round,
      interview_date: isoDateTimeString, // ✅ Dùng ISO string thay vì string thường
      duration: editFormData.duration,
      format: editFormData.format,
      interviewer: editFormData.interviewer,
      location: editFormData.location
    };

    console.log('🔍 Debug - Update Payload:', updatePayload);

    const { error, data } = await supabase
      .from('cv_interviews')
      .update(updatePayload)
      .eq('id', editFormData.id)
      .select(); // ✅ Thêm .select() để xem response

    if (error) {
      console.error('❌ Supabase Error:', error);
      throw error;
    }

    console.log('✅ Update Success:', data);

    // Refresh list
    const { data: updatedInterviews } = await supabase
      .from('cv_interviews')
      .select(`
        *,
        cv_candidates!candidate_id (
          full_name,
          cv_jobs!job_id ( id, title )
        )
      `)
      .order('interview_date', { ascending: false });

    if (updatedInterviews) {
      setInterviews(updatedInterviews.map(i => ({
        ...i, 
        status: getInterviewStatus(i as Interview)
      })) as Interview[]);
    }

    setIsEditDialogOpen(false);
    setFormErrors({ interview_date: "", interview_time: "", duration: "" }); // ✅ Clear errors
    alert('Cập nhật lịch phỏng vấn thành công!');
  } catch (error: any) {
    console.error('❌ Error updating interview:', error);
    alert(`Có lỗi xảy ra khi cập nhật: ${error.message || 'Unknown error'}`);
  } finally {
    setSubmitting(false);
  }
 };

 // --- ACTION: Mở form đánh giá ---
const handleOpenReviewForm = (interview: Interview) => {
  setInterviewToReview(interview);
  setReviewData({ rating: 0, notes: '', outcome: 'Vòng tiếp theo' });
  setIsReviewFormDialogOpen(true);
};

// --- ACTION: Submit đánh giá FORM MỚI ---
  const handleSubmitReviewForm = async () => {
  if (!interviewToReview || reviewData.rating === 0) {
    alert('Vui lòng chọn số sao đánh giá!');
    return;
  }

  setSubmitting(true);
  try {
    // 1. Tạo review mới
    const { error: reviewError } = await supabase
      .from('cv_interview_reviews')
      .insert([{
        interview_id: interviewToReview.id,
        rating: reviewData.rating,
        notes: reviewData.notes,
        outcome: reviewData.outcome
      }]);

    if (reviewError) throw reviewError;

    // 2. Cập nhật trạng thái interview thành "Hoàn thành"
    const { error: updateError } = await supabase
      .from('cv_interviews')
      .update({ status: 'Hoàn thành' })
      .eq('id', interviewToReview.id);

    if (updateError) throw updateError;

    // 3. Refresh danh sách interviews
    const { data: updatedInterviews } = await supabase
      .from('cv_interviews')
      .select(`
        *,
        cv_candidates!candidate_id (
          full_name,
          cv_jobs!job_id ( id, title )
        )
      `)
      .order('interview_date', { ascending: false });

    if (updatedInterviews) {
      setInterviews(updatedInterviews.map(i => ({
        ...i, 
        status: getInterviewStatus(i as Interview)
      })) as Interview[]);
    }

    // 4. Đóng dialog và reset
    setIsReviewFormDialogOpen(false);
    setInterviewToReview(null);
    setReviewData({ rating: 0, notes: '', outcome: 'Vòng tiếp theo' });

    alert('Đánh giá đã được lưu thành công!');
  } catch (error) {
    console.error('Error submitting review:', error);
    alert('Có lỗi xảy ra khi lưu đánh giá!');
  } finally {
    setSubmitting(false);
  }
  };
  // --- Render Helpers ---

  // Thống kê
  const totalInterviews = interviews.length;
  const pendingInterviews = interviews.filter(i => i.status === 'Đang chờ').length;
  const completedInterviews = interviews.filter(i => i.status === 'Hoàn thành').length;
  const cancelledInterviews = interviews.filter(i => i.status === 'Đã hủy').length;

  // Lọc dữ liệu
  const filteredInterviews = interviews.filter(interview => {
    const matchesSearch = 
      interview.cv_candidates?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interview.cv_candidates?.cv_jobs?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || interview.status === statusFilter;
    const matchesPosition = positionFilter === 'all' || interview.cv_candidates?.cv_jobs?.title === positionFilter;

    return matchesSearch && matchesStatus && matchesPosition;
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Hoàn thành':
        return 'bg-green-100 text-green-700 hover:bg-green-100';
      case 'Đang chờ':
        return 'bg-orange-100 text-orange-700 hover:bg-orange-100';
      case 'Đang phỏng vấn':
        return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
      case 'Đang đánh giá':
        return 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100';
      case 'Đang chờ đánh giá':
        return 'bg-purple-100 text-purple-700 hover:bg-purple-100';
      case 'Đã hủy':
        return 'bg-red-100 text-red-700 hover:bg-red-100';
      default:
        return 'bg-gray-100 text-gray-700 hover:bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            Lịch phỏng vấn
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý và theo dõi lịch phỏng vấn</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Tạo lịch phỏng vấn
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Tổng số */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Tổng số</p>
                <div className="text-3xl font-bold">{totalInterviews}</div>
                <p className="text-xs text-blue-600 font-medium">+8%</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Đang chờ */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Đang chờ</p>
                <div className="text-3xl font-bold">{pendingInterviews}</div>
                <p className="text-xs text-orange-600 font-medium">+3%</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        {/* Hoàn thành */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Hoàn thành</p>
                <div className="text-3xl font-bold">{completedInterviews}</div>
                <p className="text-xs text-green-600 font-medium">+12%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* Đã hủy */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Đã hủy</p>
                <div className="text-3xl font-bold">{cancelledInterviews}</div>
                <p className="text-xs text-red-600 font-medium">-5%</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Tìm kiếm theo tên ứng viên, vị trí..." 
            className="pl-10 bg-white" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Tất cả vị trí" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả vị trí</SelectItem>
            {Array.from(new Set(interviews.map(i => i.cv_candidates?.cv_jobs?.title).filter(Boolean))).map(position => (
              <SelectItem key={position} value={position as string}>{position}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Tất cả trạng thái" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="Đang chờ">Đang chờ</SelectItem>
            <SelectItem value="Đang phỏng vấn">Đang phỏng vấn</SelectItem>
            <SelectItem value="Đang đánh giá">Đang đánh giá</SelectItem>
            <SelectItem value="Đang chờ đánh giá">Đang chờ đánh giá</SelectItem>
            <SelectItem value="Hoàn thành">Hoàn thành</SelectItem>
            <SelectItem value="Đã hủy">Đã hủy</SelectItem>
          </SelectContent>
        </Select>

        <Select>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Tất cả" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Danh sách lịch phỏng vấn</CardTitle>
          <div className="text-sm text-muted-foreground">
            {filteredInterviews.length} / {totalInterviews}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ứng viên</TableHead>
                <TableHead>Vị trí ứng tuyển</TableHead>
                <TableHead>Vòng phỏng vấn</TableHead>
                <TableHead>Ngày & Giờ</TableHead>
                <TableHead>Người phỏng vấn</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-64">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                      <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredInterviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-64">
                    <div className="flex flex-col items-center justify-center">
                      <Calendar className="h-16 w-16 text-gray-300 mb-4" />
                      <h3 className="text-base font-medium text-gray-900">
                        {searchTerm || statusFilter !== 'all' || positionFilter !== 'all' 
                          ? 'Không tìm thấy kết quả phù hợp' 
                          : 'Chưa có lịch phỏng vấn nào'}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {searchTerm || statusFilter !== 'all' || positionFilter !== 'all'
                          ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'
                          : 'Bắt đầu bằng cách tạo lịch phỏng vấn mới'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredInterviews.map((interview) => (
                  <TableRow key={interview.id}>
                    <TableCell className="font-medium">
                      {interview.cv_candidates?.full_name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {interview.cv_candidates?.cv_jobs?.title || 'N/A'}
                    </TableCell>
                    <TableCell>{interview.round}</TableCell>
                    <TableCell>
                      {new Date(interview.interview_date).toLocaleString('vi-VN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell>{interview.interviewer}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeClass(interview.status)}>
                        {interview.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white">
                            {/* Xem chi tiết - Luôn hiển thị */}
                            <DropdownMenuItem onClick={() => handleViewDetail(interview)}>
                             Xem chi tiết
                            </DropdownMenuItem>
  
                            {/* ✅ NẾU HOÀN THÀNH - Chỉ có "Xem chi tiết" */}
                            {interview.status !== 'Hoàn thành' && (
                              <>
                                {/* Chỉnh sửa - Chỉ khi Đang chờ */}
                                {interview.status === 'Đang chờ' && (
                                  <DropdownMenuItem onClick={() => handleEditClick(interview)}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                       Chỉnh sửa
                                  </DropdownMenuItem>
                                )}
      
                                {/* Kết thúc sớm - Chỉ khi Đang phỏng vấn */}
                                {interview.status === 'Đang phỏng vấn' && (
                                  <DropdownMenuItem
                                     className="text-orange-600"
                                     onClick={() => handleEndInterview(interview)}
                                     disabled={submitting}
                                  >
                                   Kết thúc sớm
                                  </DropdownMenuItem>
                                )}
      
                                {/* Đánh giá - Chỉ khi Đang chờ đánh giá */}
                                {interview.status === 'Đang chờ đánh giá' && (
                                   <DropdownMenuItem
                                      className="text-blue-600"
                                      onClick={() => handleOpenReviewForm(interview)}
                                    >
                                      <Star className="w-4 h-4 mr-2" />
                                        Đánh giá
                                   </DropdownMenuItem>
                                 )}
      
                                {/* Hủy lịch - Không hiện khi Hoàn thành */}
                                    <DropdownMenuItem 
                                       className="text-red-600"
                                       onClick={() => handleDelete(interview)}
                                    >
                                       Hủy lịch
                                    </DropdownMenuItem>
                                  </>
                                )}
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

      {/* Dialog tạo lịch phỏng vấn (V1 UI + Logic URL Params) */}
      {isDialogOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            style={{ zIndex: 999999 }}
            onClick={() => setIsDialogOpen(false)}
          />
          
          {/* Dialog Container */}
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000000 }}>
            {/* Dialog Content */}
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 pointer-events-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Tạo lịch phỏng vấn mới
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Điền thông tin chi tiết để tạo lịch phỏng vấn.
                </p>
              </div>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Ứng viên */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <User className="w-4 h-4" />
                  Ứng viên <span className="text-red-500">*</span>
                </label>

                {/* Component tìm kiếm ứng viên */}
                {!selectedCandidate ? (
                    <CandidateAutoCompleteDual
                        onCandidateSelect={handleCandidateSelect}
                        className="w-full"
                    />
                ) : (
                    <>
                        {/* Box thông báo ứng viên đã chọn */}
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <p className="text-sm font-medium text-blue-800">
                                Đã chọn ứng viên: {selectedCandidate.full_name} và {selectedCandidate.email}
                            </p>
                        </div>

                        {/* 2 ô input tên và email chỉ để hiển thị (readonly) */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Họ và tên</label>
                                <Input
                                    value={selectedCandidate.full_name}
                                    readOnly
                                    className="bg-gray-50 border-gray-300"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email</label>
                                <Input
                                    type="email"
                                    value={selectedCandidate.email}
                                    readOnly
                                    className="bg-gray-50 border-gray-300"
                                />
                            </div>
                        </div>

                        {/* Nút xóa lựa chọn */}
                        <div className="flex items-center justify-between p-2 border rounded-md bg-gray-50">
                            <span className="font-medium text-sm text-gray-600">Có thể thay đổi ứng viên</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSelectedCandidate(null);
                                    setFormData(prev => ({...prev, candidate_id: "", job_id: ""}));
                                }}
                                type="button"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </>
                )}
              </div>

              {/* Vị trí ứng tuyển */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Briefcase className="w-4 h-4" />
                  Vị trí ứng tuyển <span className="text-red-500">*</span>
                </label>

                {selectedCandidate?.cv_jobs ? (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        Vị trí đang ứng tuyển:
                      </p>
                      <p className="text-base font-semibold text-blue-900">
                        {selectedCandidate.cv_jobs.title}
                      </p>
                      <p className="text-xs text-blue-600">
                        Cấp bậc: {selectedCandidate.cv_jobs.level}
                      </p>
                    </div>
                  </div>
                ) : (
                  <Select 
                    value={formData.job_id}
                    onValueChange={(value) => setFormData({...formData, job_id: value})}
                    required
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Chọn vị trí ứng tuyển" />
                    </SelectTrigger>
                    <SelectContent className="bg-white" style={{ zIndex: 1000001 }}>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Vòng phỏng vấn */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <div className="w-4 h-4 rounded-full border-2 border-current" />
                  Vòng phỏng vấn <span className="text-red-500">*</span>
                </label>
                <Select 
                  value={formData.round} 
                  onValueChange={(value) => setFormData({...formData, round: value})}
                  required
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Chọn vòng phỏng vấn" />
                  </SelectTrigger>
                  <SelectContent className="bg-white" style={{ zIndex: 1000001 }}>
                    <SelectItem value="Vòng 1">Vòng 1 - Sơ tuyển</SelectItem>
                    <SelectItem value="Vòng 2">Vòng 2 - Chuyên môn</SelectItem>
                    <SelectItem value="Vòng 3">Vòng 3 - Cuối cùng</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ngày và Giờ phỏng vấn */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ngày phỏng vấn <span className="text-red-500">*</span></label>
                  <Input
                    type="date"
                    value={formData.interview_date}
                    onChange={(e) => {
                      setFormData({...formData, interview_date: e.target.value});
                      if (formErrors.interview_date) setFormErrors({...formErrors, interview_date: ""});
                    }}
                    required
                    className={`${formErrors.interview_date ? "border-red-500" : ""} bg-white`}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {formErrors.interview_date && <p className="text-xs text-red-500">{formErrors.interview_date}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Giờ phỏng vấn <span className="text-red-500">*</span></label>
                  <Input
                    type="time"
                    value={formData.interview_time}
                    onChange={(e) => {
                      setFormData({...formData, interview_time: e.target.value});
                      if (formErrors.interview_time) setFormErrors({...formErrors, interview_time: ""});
                    }}
                    required
                    className={`${formErrors.interview_time ? "border-red-500" : ""} bg-white`}
                  />
                  {formErrors.interview_time && <p className="text-xs text-red-500">{formErrors.interview_time}</p>}
                </div>
              </div>

              {/* Thời lượng */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="w-4 h-4" />
                  Thời lượng (phút)
                </label>
                <Input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => {
                    setFormData({...formData, duration: e.target.value});
                    if (formErrors.duration) setFormErrors({...formErrors, duration: ""});
                  }}
                  placeholder="60"
                  min="5"
                  step="5"
                  className={`${formErrors.duration ? "border-red-500" : ""} bg-white`}
                />
                {formErrors.duration && <p className="text-xs text-red-500">{formErrors.duration}</p>}
              </div>

              {/* Địa điểm */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="w-4 h-4" />
                  Địa điểm
                </label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="Phòng họp, địa chỉ, link online"
                  className="bg-white"
                />
              </div>

              {/* Hình thức */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Video className="w-4 h-4" />
                  Hình thức
                </label>
                <Select 
                  value={formData.format} 
                  onValueChange={(value) => setFormData({...formData, format: value})}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white" style={{ zIndex: 1000001 }}>
                    <SelectItem value="Trực tiếp">Trực tiếp</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Người phỏng vấn */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <User className="w-4 h-4" />
                  Người phỏng vấn <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.interviewer}
                  onChange={(e) => setFormData({...formData, interviewer: e.target.value})}
                  placeholder="Nhập tên người phỏng vấn"
                  className="bg-white"
                  required
                />
              </div>

              {/* Ghi chú */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Ghi chú</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Ghi chú thêm về cuộc phỏng vấn..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  disabled={submitting}
                >
                  Hủy
                </Button>
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={submitting || !formData.candidate_id || !formData.job_id || !formData.round || !formData.interview_date || !formData.interview_time || !formData.interviewer}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {submitting ? 'Đang tạo...' : 'Tạo lịch phỏng vấn'}
                </Button>
              </div>
            </form>
          </div>
        </div>
        </>
      )}

      {/* --- MỚI: Dialog Chỉnh Sửa Lịch Phỏng Vấn --- */}
      {isEditDialogOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            style={{ zIndex: 999999 }}
            onClick={() => setIsEditDialogOpen(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000000 }}>
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 pointer-events-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Pencil className="w-5 h-5 text-blue-600" />
                    Chỉnh sửa lịch phỏng vấn
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Cập nhật thông tin cho lịch phỏng vấn đang chờ.
                  </p>
                </div>
                <button
                  onClick={() => setIsEditDialogOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Edit */}
              <form onSubmit={handleUpdate} className="p-6 space-y-6">
                
                {/* Ứng viên (Readonly) */}
                <div className="space-y-2">
                   <label className="flex items-center gap-2 text-sm font-medium">
                    <User className="w-4 h-4" /> Ứng viên (Không thể thay đổi)
                   </label>
                   <Input value={editFormData.candidate_name} disabled className="bg-gray-100" />
                </div>

                {/* Vị trí ứng tuyển */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Briefcase className="w-4 h-4" />
                    Vị trí ứng tuyển
                  </label>
                  <Select 
                    value={editFormData.job_id}
                    onValueChange={(value) => setEditFormData({...editFormData, job_id: value})}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Chọn vị trí" />
                    </SelectTrigger>
                    <SelectContent className="bg-white" style={{ zIndex: 1000001 }}>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Vòng phỏng vấn */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    Vòng phỏng vấn <span className="text-red-500">*</span>
                  </label>
                  <Select 
                    value={editFormData.round} 
                    onValueChange={(value) => setEditFormData({...editFormData, round: value})}
                    required
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Chọn vòng phỏng vấn" />
                    </SelectTrigger>
                    <SelectContent className="bg-white" style={{ zIndex: 1000001 }}>
                      <SelectItem value="Vòng 1">Vòng 1 - Sơ tuyển</SelectItem>
                      <SelectItem value="Vòng 2">Vòng 2 - Chuyên môn</SelectItem>
                      <SelectItem value="Vòng 3">Vòng 3 - Cuối cùng</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Ngày và Giờ phỏng vấn */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ngày phỏng vấn <span className="text-red-500">*</span></label>
                    <Input
                      type="date"
                      value={editFormData.interview_date}
                      onChange={(e) => setEditFormData({...editFormData, interview_date: e.target.value})}
                      required
                      className={`${formErrors.interview_date ? "border-red-500" : ""} bg-white`}
                    />
                    {formErrors.interview_date && <p className="text-xs text-red-500">{formErrors.interview_date}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Giờ phỏng vấn <span className="text-red-500">*</span></label>
                    <Input
                      type="time"
                      value={editFormData.interview_time}
                      onChange={(e) => setEditFormData({...editFormData, interview_time: e.target.value})}
                      required
                      className={`${formErrors.interview_time ? "border-red-500" : ""} bg-white`}
                    />
                    {formErrors.interview_time && <p className="text-xs text-red-500">{formErrors.interview_time}</p>}
                  </div>
                </div>

                {/* Thời lượng */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="w-4 h-4" />
                    Thời lượng (phút)
                  </label>
                  <Input
                    type="number"
                    value={editFormData.duration}
                    onChange={(e) => setEditFormData({...editFormData, duration: e.target.value})}
                    placeholder="60"
                    min="5"
                    step="5"
                    className={`${formErrors.duration ? "border-red-500" : ""} bg-white`}
                  />
                   {formErrors.duration && <p className="text-xs text-red-500">{formErrors.duration}</p>}
                </div>

                {/* Địa điểm */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="w-4 h-4" />
                    Địa điểm
                  </label>
                  <Input
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({...editFormData, location: e.target.value})}
                    placeholder="Phòng họp, địa chỉ, link online"
                    className="bg-white"
                  />
                </div>

                {/* Hình thức */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Video className="w-4 h-4" />
                    Hình thức
                  </label>
                  <Select 
                    value={editFormData.format} 
                    onValueChange={(value) => setEditFormData({...editFormData, format: value})}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white" style={{ zIndex: 1000001 }}>
                      <SelectItem value="Trực tiếp">Trực tiếp</SelectItem>
                      <SelectItem value="Online">Online</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Người phỏng vấn */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <User className="w-4 h-4" />
                    Người phỏng vấn <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={editFormData.interviewer}
                    onChange={(e) => setEditFormData({...editFormData, interviewer: e.target.value})}
                    placeholder="Nhập tên người phỏng vấn"
                    className="bg-white"
                    required
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditDialogOpen(false)}
                    disabled={submitting}
                  >
                    Hủy
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={submitting}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    {submitting ? 'Đang cập nhật...' : 'Cập nhật thay đổi'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Dialog Xem Chi Tiết */}
      {isDetailDialogOpen && selectedInterview && (
        <>
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            style={{ zIndex: 999999 }}
            onClick={() => setIsDetailDialogOpen(false)}
          />
          
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000000 }}>
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 pointer-events-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Chi tiết lịch phỏng vấn
                </h2>
                <button
                  onClick={() => setIsDetailDialogOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Ứng viên</label>
                    <p className="mt-1 text-base font-semibold">{selectedInterview.cv_candidates?.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Vị trí ứng tuyển</label>
                    <p className="mt-1 text-base">{selectedInterview.cv_candidates?.cv_jobs?.title || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Vòng phỏng vấn</label>
                    <p className="mt-1 text-base">{selectedInterview.round}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Trạng thái</label>
                    <div className="mt-1">
                      <Badge className={getStatusBadgeClass(selectedInterview.status)}>
                        {selectedInterview.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Ngày & Giờ</label>
                    <p className="mt-1 text-base">
                      {new Date(selectedInterview.interview_date).toLocaleString('vi-VN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Thời lượng</label>
                    <p className="mt-1 text-base">{selectedInterview.duration} phút</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Người phỏng vấn</label>
                    <p className="mt-1 text-base">{selectedInterview.interviewer}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Hình thức</label>
                    <p className="mt-1 text-base">{selectedInterview.format}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-600">Địa điểm</label>
                    <p className="mt-1 text-base">{selectedInterview.location || 'Chưa có thông tin'}</p>
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

      {/* Dialog Đánh giá sau khi Hoàn thành */}
      {isReviewDialogOpen && selectedInterview && (
        <>
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            style={{ zIndex: 999999 }}
            onClick={() => {
              setIsReviewDialogOpen(false);
              setReviewData({ rating: 0, notes: '', outcome: 'Vòng tiếp theo' });
            }}
          />
          
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000000 }}>
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg m-4 pointer-events-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Đánh giá buổi phỏng vấn
                </h2>
                <button
                  onClick={() => {
                    setIsReviewDialogOpen(false);
                    setReviewData({ rating: 0, notes: '', outcome: 'Vòng tiếp theo' });
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
                  <p className="font-semibold text-lg">{selectedInterview.cv_candidates?.full_name}</p>
                  <p className="text-sm text-gray-600 mt-1">{selectedInterview.cv_candidates?.cv_jobs?.title}</p>
                </div>

                {/* Rating */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Đánh giá <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewData({...reviewData, rating: star})}
                        className="transition-transform hover:scale-110"
                      >
                        <Star 
                          className={`w-10 h-10 ${
                            star <= reviewData.rating 
                              ? 'fill-yellow-400 text-yellow-400' 
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-lg font-semibold text-gray-700">
                      {reviewData.rating > 0 ? `${reviewData.rating}/5` : 'Chưa chọn'}
                    </span>
                  </div>
                </div>

                {/* Outcome */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Kết quả <span className="text-red-500">*</span>
                  </label>
                  <Select 
                    value={reviewData.outcome}
                    onValueChange={(value) => setReviewData({...reviewData, outcome: value})}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white" style={{ zIndex: 1000001 }}>
                      <SelectItem value="Vòng tiếp theo">Vòng tiếp theo</SelectItem>
                      <SelectItem value="Đạt">Đạt</SelectItem>
                      <SelectItem value="Không đạt">Không đạt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ghi chú đánh giá</label>
                  <textarea
                    value={reviewData.notes}
                    onChange={(e) => setReviewData({...reviewData, notes: e.target.value})}
                    placeholder="Nhập ghi chú về buổi phỏng vấn..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                  />
                </div>
              </div>

              <div className="border-t px-6 py-4 flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsReviewDialogOpen(false);
                    setReviewData({ rating: 0, notes: '', outcome: 'Vòng tiếp theo' });
                  }}
                  disabled={submitting}
                >
                  Hủy
                </Button>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSubmitReview}
                  disabled={submitting || reviewData.rating === 0}
                >
                  <Star className="w-4 h-4 mr-2" />
                  {submitting ? 'Đang lưu...' : 'Lưu đánh giá'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ✅ MỚI: Dialog Form Đánh Giá */}
      {isReviewFormDialogOpen && interviewToReview && (
        <> 
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            style={{ zIndex: 999999 }}
            onClick={() => {
              setIsReviewFormDialogOpen(false);
              setInterviewToReview(null);
              setReviewData({ rating: 0, notes: '', outcome: 'Vòng tiếp theo' });
            }}
          />
    
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1000000 }}>
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg m-4 pointer-events-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Đánh giá buổi phỏng vấn
                </h2>
                <button
                  onClick={() => {
                    setIsReviewFormDialogOpen(false);
                    setInterviewToReview(null);
                    setReviewData({ rating: 0, notes: '', outcome: 'Vòng tiếp theo' });
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
                  <p className="font-semibold text-lg">{interviewToReview.cv_candidates?.full_name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {interviewToReview.cv_candidates?.cv_jobs?.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {interviewToReview.round} • {interviewToReview.interviewer}
                  </p>
                </div>

                {/* Rating */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Đánh giá <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewData({...reviewData, rating: star})}
                  className="transition-transform hover:scale-110"
                >
                  <Star 
                    className={`w-10 h-10 ${
                      star <= reviewData.rating 
                        ? 'fill-yellow-400 text-yellow-400' 
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-lg font-semibold text-gray-700">
                {reviewData.rating > 0 ? `${reviewData.rating}/5` : 'Chưa chọn'}
              </span>
            </div>
          </div>

          {/* Outcome */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Kết quả <span className="text-red-500">*</span>
            </label>
            <Select 
              value={reviewData.outcome}
              onValueChange={(value) => setReviewData({...reviewData, outcome: value})}
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white" style={{ zIndex: 1000001 }}>
                <SelectItem value="Vòng tiếp theo">Vòng tiếp theo</SelectItem>
                <SelectItem value="Đạt">Đạt</SelectItem>
                <SelectItem value="Không đạt">Không đạt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Ghi chú đánh giá</label>
            <textarea
              value={reviewData.notes}
              onChange={(e) => setReviewData({...reviewData, notes: e.target.value})}
              placeholder="Nhập ghi chú về buổi phỏng vấn..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              setIsReviewFormDialogOpen(false);
              setInterviewToReview(null);
              setReviewData({ rating: 0, notes: '', outcome: 'Vòng tiếp theo' });
            }}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleSubmitReview}
            disabled={submitting || reviewData.rating === 0}
          >
            <Star className="w-4 h-4 mr-2" />
            {submitting ? 'Đang lưu...' : 'Lưu đánh giá'}
          </Button>
        </div>
      </div>
    </div>
  </>
)}
    </div>
  )
}