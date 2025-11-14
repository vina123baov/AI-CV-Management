"""
Backend API for CV Management System
Uses OpenRouter AI for both CV parsing and job matching
✅ UPDATED: Đọc chính xác hơn các trường thông tin từ database
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
import io
import json
import requests
import PyPDF2
from docx import Document

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY not found in environment variables")

app = FastAPI(
    title="CV Management API",
    description="API for parsing CVs and matching with jobs using OpenRouter AI",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== MODELS ====================

class CVData(BaseModel):
    full_name: str
    email: str
    phone_number: Optional[str] = None
    address: Optional[str] = None
    university: Optional[str] = None
    education: Optional[str] = None
    experience: Optional[str] = None

class JobData(BaseModel):
    id: str
    title: str
    department: Optional[str] = None
    level: Optional[str] = None
    job_type: Optional[str] = None
    work_location: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    benefits: Optional[str] = None
    mandatory_requirements: Optional[str] = None

class MatchCVJobsRequest(BaseModel):
    cv_text: str
    cv_data: CVData
    jobs: List[JobData]
    primary_job_id: Optional[str] = None

# ==================== HELPERS ====================

def call_openrouter_api(messages: List[dict], model: str = "openai/gpt-4o-mini", temperature: float = 0.7, max_tokens: int = 4000) -> dict:
    try:
        response = requests.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "CV Management System"
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            },
            timeout=60
        )
        
        if response.status_code != 200:
            error_data = response.json()
            raise HTTPException(
                status_code=response.status_code,
                detail=f"OpenRouter API error: {error_data.get('error', {}).get('message', 'Unknown error')}"
            )
        
        return response.json()
    
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="OpenRouter API timeout")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Request error: {str(e)}")

def extract_json_from_response(content: str) -> dict:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0].strip()
        elif '```' in content:
            content = content.split('```')[1].split('```')[0].strip()
        
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse AI response as JSON: {str(e)}")

# ==================== ENDPOINTS ====================

@app.get("/")
async def root():
    return {"message": "CV Management API", "version": "1.0.0", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "openrouter_configured": bool(OPENROUTER_API_KEY)}

@app.post("/api/parse-cv")
async def parse_cv(file: UploadFile = File(None), cv_file: UploadFile = File(None)):
    try:
        upload_file = file if file else cv_file
        
        if not upload_file:
            raise HTTPException(status_code=422, detail="No file provided")
        
        print(f"\n📄 ===== CV PARSING START =====")
        print(f"📎 File: {upload_file.filename}")
        
        if not upload_file.filename.endswith(('.pdf', '.doc', '.docx')):
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        file_content = await upload_file.read()
        if not file_content:
            raise HTTPException(status_code=400, detail="File is empty")
        
        print(f"💾 File size: {len(file_content)/1024:.2f} KB")
        
        cv_text = ""
        
        if upload_file.filename.endswith('.pdf'):
            print("🔍 Parsing PDF...")
            pdf_file = io.BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            for page_num, page in enumerate(pdf_reader.pages):
                text = page.extract_text()
                if text:
                    cv_text += text + "\n"
                    print(f"  ✓ Page {page_num + 1}: {len(text)} chars")
        
        elif upload_file.filename.endswith(('.doc', '.docx')):
            print("🔍 Parsing DOCX...")
            doc_file = io.BytesIO(file_content)
            doc = Document(doc_file)
            cv_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        
        if not cv_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from CV")
        
        print(f"✅ Extracted {len(cv_text)} characters")
        
        ai_input_text = cv_text[:4000] if len(cv_text) > 4000 else cv_text
        
        print(f"🤖 Calling OpenRouter AI...")
        
        messages = [
            {"role": "system", "content": "You are a professional CV parser. Extract structured information. Return ONLY valid JSON."},
            {"role": "user", "content": f"""Parse this CV and return JSON:

{ai_input_text}

Return this structure:
{{
  "full_name": "string or null",
  "email": "string or null",
  "phone_number": "string or null",
  "address": "string or null",
  "university": "string or null",
  "education": "string or null",
  "experience": "string or null",
  "skills": ["skill1", "skill2"] or [],
  "summary": "string or null"
}}"""}
        ]
        
        result = call_openrouter_api(messages=messages, model="openai/gpt-4o-mini", temperature=0.3, max_tokens=2000)
        
        print(f"✅ OpenRouter responded")
        
        content = result['choices'][0]['message']['content']
        parsed_data = extract_json_from_response(content)
        parsed_data['fullText'] = cv_text
        
        print(f"✅ Parsed: {parsed_data.get('full_name', 'N/A')}")
        print(f"===== CV PARSING END =====\n")
        
        return {
            "success": True,
            "data": parsed_data,
            "message": "CV parsed successfully",
            "metadata": {"model": "gpt-4o-mini", "filename": upload_file.filename}
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error parsing CV: {str(e)}")

@app.post("/api/match-cv-jobs")
async def match_cv_jobs(request: MatchCVJobsRequest):
    """
    ✅ UPDATED LOGIC: Đọc chính xác hơn các trường DB và mapping đúng với job
    1. Check mandatory FIRST (đọc kỹ từng trường DB)
    2. If NOT met → Penalty -50 điểm NGAY
    3. Score trên base còn lại (base 50 nếu failed, base 100 nếu passed)
    """
    try:
        print(f"\n🎯 ===== CV-JOB MATCHING START =====")
        print(f"👤 Candidate: {request.cv_data.full_name}")
        print(f"📋 Jobs to analyze: {len(request.jobs)}")
        
        if not request.jobs or len(request.jobs) == 0:
            raise HTTPException(status_code=400, detail="No jobs provided for matching")
        
        jobs_with_mandatory = [j for j in request.jobs if j.mandatory_requirements]
        if jobs_with_mandatory:
            print(f"⚠️  Jobs with mandatory requirements: {len(jobs_with_mandatory)}")
        
        jobs_context = []
        for job in request.jobs:
            is_primary = job.id == request.primary_job_id
            
            job_info = f"""━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{'⭐ JOB ỨNG VIÊN ĐÃ APPLY (PRIMARY) ⭐' if is_primary else f'JOB ID: {job.id}'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Thông tin công việc:
- Tên vị trí: {job.title}
- Phòng ban: {job.department or 'N/A'}
- Cấp bậc: {job.level or 'N/A'}
- Loại hợp đồng: {job.job_type or 'N/A'}
- Địa điểm: {job.work_location or job.location or 'N/A'}

📝 Mô tả công việc:
{job.description or 'N/A'}

✅ Yêu cầu công việc:
{job.requirements or 'N/A'}

💰 Phúc lợi:
{job.benefits or 'N/A'}"""
            
            if job.mandatory_requirements and job.mandatory_requirements.strip():
                job_info += f"""

⚠️⚠️⚠️ YÊU CẦU BẮT BUỘC (MANDATORY - PHẢI ĐÁP ỨNG) ⚠️⚠️⚠️
{job.mandatory_requirements}
⚠️ Nếu KHÔNG đáp ứng → Penalty -50 điểm NGAY LẬP TỨC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"""
                print(f"  ⚠️  Job '{job.title}' mandatory: {job.mandatory_requirements[:80]}...")
            
            if is_primary:
                job_info += "\n\n🌟 ĐÂY LÀ VỊ TRÍ ỨNG VIÊN ĐÃ APPLY - ƯU TIÊN ĐÁNH GIÁ KỸ 🌟"
            
            jobs_context.append(job_info)
        
        jobs_text = "\n\n".join(jobs_context)
        
        cv_context = f"""━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROFILE ỨNG VIÊN ĐẦY ĐỦ (ĐỌC KỸ TẤT CẢ TRƯỜNG THÔNG TIN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 THÔNG TIN CƠ BẢN
━━━━━━━━━━━━━━━━━━━━━━
Họ tên đầy đủ: {request.cv_data.full_name}
Email: {request.cv_data.email}
Số điện thoại: {request.cv_data.phone_number or 'Không có thông tin'}
Địa chỉ: {request.cv_data.address or 'Không có thông tin'}

🎓 HỌC VẤN & BẰNG CẤP
━━━━━━━━━━━━━━━━━━━━━━
Trường đại học: {request.cv_data.university or 'Không có thông tin'}
Bằng cấp/Chuyên ngành: {request.cv_data.education or 'Không có thông tin'}

💼 KINH NGHIỆM LÀM VIỆC & KỸ NĂNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{request.cv_data.experience or 'Không có thông tin'}

📄 NỘI DUNG CV TOÀN VĂN (ĐỌC KỸ ĐỂ TÌM BẰNG CHỨNG)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{request.cv_text[:4000]}

⚠️ LƯU Ý QUAN TRỌNG:
- ĐỌC KỸ TẤT CẢ CÁC TRƯỜNG THÔNG TIN TRÊN
- TÌM KIẾM BẰNG CHỨNG CỤ THỂ trong CV để xác nhận yêu cầu bắt buộc
- So sánh CHI TIẾT với từng yêu cầu của công việc
- Chú ý đến TÊN TRƯỜNG, BẰNG CẤP, KỸ NĂNG, KINH NGHIỆM cụ thể
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"""
        
        messages = [
            {
                "role": "system",
                "content": """Bạn là chuyên gia HR với 15+ năm kinh nghiệm.

QUY TRÌNH CHẤM ĐIỂM CHÍNH XÁC:

CHO MỖI CÔNG VIỆC, LÀM THEO THỨ TỰ SAU:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BƯỚC 1: KIỂM TRA YÊU CẦU BẮT BUỘC TRƯỚC (Ưu tiên cao nhất)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NẾU công việc có "⚠️ YÊU CẦU BẮT BUỘC (MANDATORY)":

a) Đọc KỸ TẤT CẢ thông tin ứng viên:
   - Trường "Trường đại học" 
   - Trường "Bằng cấp/Chuyên ngành"
   - Text "Kinh nghiệm làm việc & Kỹ năng"
   - "Nội dung CV toàn văn"
   - Tìm keyword chính xác, tên trường, bằng cấp, kỹ năng

b) Tìm bằng chứng cụ thể:
   - Yêu cầu "Tốt nghiệp Đại học": Tìm tên trường, bachelor, cử nhân, đại học
   - Yêu cầu "Python": Tìm từ khóa Python trong skills/kinh nghiệm
   - Yêu cầu "3 năm kinh nghiệm": Tính từ ngày tháng hoặc mô tả rõ ràng
   - Yêu cầu "CNTT": Tìm Công nghệ thông tin, Computer Science, IT

c) Quyết định:
   ✅ TÌM THẤY bằng chứng → Ứng viên ĐÁP ỨNG → Chuyển sang BƯỚC 2A
   ❌ KHÔNG tìm thấy → Ứng viên KHÔNG ĐÁP ỨNG → Chuyển sang BƯỚC 2B

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BƯỚC 2A: CHẤM ĐIỂM TRÊN BASE 100 (Nếu đáp ứng hoặc không có yêu cầu bắt buộc)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Chấm điểm bình thường theo thang 100:
- Kinh nghiệm phù hợp: 0-30 điểm
- Kỹ năng kỹ thuật: 0-25 điểm
- Học vấn: 0-15 điểm
- Level phù hợp: 0-15 điểm
- Địa điểm: 0-10 điểm
- Kỹ năng mềm: 0-5 điểm

Điểm cuối = Tổng (0-100)
Điểm yếu: Các điểm yếu thông thường (KHÔNG liên quan mandatory)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BƯỚC 2B: ÁP DỤNG PENALTY VÀ CHẤM TRÊN BASE 50 (Nếu KHÔNG đáp ứng bắt buộc)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Áp dụng penalty NGAY LẬP TỨC:
- Base điểm giảm: 100 → 50
- Điểm tối đa có thể: 50

SAU ĐÓ chấm trên BASE MỚI (thang 50):
- Kinh nghiệm phù hợp: 0-15 điểm (giảm 50%)
- Kỹ năng kỹ thuật: 0-12 điểm (giảm 50%)
- Học vấn: 0-8 điểm (giảm 50%)
- Level phù hợp: 0-8 điểm (giảm 50%)
- Địa điểm: 0-5 điểm (giảm 50%)
- Kỹ năng mềm: 0-2 điểm (giảm 50%)

Điểm cuối = Tổng (0-50 tối đa)
Điểm yếu: PHẢI có "Ứng viên không đáp ứng yêu cầu bắt buộc: [yêu cầu cụ thể]" + các điểm yếu khác

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUAN TRỌNG: Với JOB ⭐ PRIMARY (job ứng viên đã apply):
- Đánh giá CHI TIẾT HỖN hơn
- Đây là job ứng viên QUAN TÂM - phải đánh giá kỹ lưỡng
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Trả về ONLY valid JSON."""
            },
            {
                "role": "user",
                "content": f"""Phân tích CV và matching với các công việc theo QUY TRÌNH CHÍNH XÁC:

{cv_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CÁC CÔNG VIỆC CẦN MATCHING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{jobs_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CHO MỖI CÔNG VIỆC, ÁP DỤNG QUY TRÌNH:

VÍ DỤ MINH HỌA:

Ví dụ 1: Job yêu cầu "Tốt nghiệp Đại học" + Ứng viên có "university: HUST"
→ Bắt buộc: ĐÁP ỨNG ✅
→ Base điểm: 100
→ Tính: 28 (exp) + 23 (skills) + 15 (edu) + 12 (level) + 8 (loc) + 3 (soft) = 89
→ Kết quả: 89/100
→ Điểm yếu: ["Thiếu kinh nghiệm quản lý nhóm"]

Ví dụ 2: Job yêu cầu "Tốt nghiệp Đại học" + Ứng viên university: null, education: null
→ Bắt buộc: KHÔNG ĐÁP ỨNG ❌
→ Penalty: -50 NGAY LẬP TỨC
→ Base điểm mới: 50 tối đa
→ Tính trên base 50: 12 (exp) + 10 (skills) + 0 (edu) + 6 (level) + 4 (loc) + 2 (soft) = 34
→ Kết quả: 34/50
→ Điểm yếu: ["Ứng viên không đáp ứng yêu cầu bắt buộc: Tốt nghiệp Đại học", "Thiếu kinh nghiệm cloud"]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Trả về JSON:
{{
  "overall_score": 85,
  "best_match": {{
    "job_id": "uuid",
    "job_title": "Tên công việc",
    "match_score": 88,
    "strengths": ["điểm mạnh 1", "điểm mạnh 2", "điểm mạnh 3"],
    "weaknesses": ["điểm yếu 1", "điểm yếu 2"],
    "recommendation": "Nhận xét chi tiết 80-120 từ"
  }},
  "all_matches": [
    {{
      "job_id": "uuid-1",
      "job_title": "Job 1",
      "match_score": 88,
      "strengths": ["s1", "s2", "s3"],
      "weaknesses": ["w1", "w2"],
      "recommendation": "..."
    }}
  ]
}}

LƯU Ý QUAN TRỌNG:
- Đọc KỸ TẤT CẢ các trường: university, education, experience, fullText
- Kiểm tra yêu cầu bắt buộc TRƯỚC KHI chấm điểm
- Áp dụng penalty -50 NGAY nếu không đáp ứng
- Chấm điểm trên base 50 (KHÔNG phải base 100) sau khi penalty
- Thêm "Ứng viên không đáp ứng yêu cầu bắt buộc" vào điểm yếu
- Tìm kiếm kỹ lưỡng bằng chứng trong CV
- Sắp xếp all_matches theo match_score giảm dần
- PHẢI trả về đầy đủ overall_score, best_match, all_matches
- best_match là job có điểm match_score CAO NHẤT
- Nếu có PRIMARY job, ưu tiên đánh giá kỹ hơn"""
            }
        ]
        
        print(f"🤖 Calling OpenRouter AI...")
        
        result = call_openrouter_api(messages=messages, model="openai/gpt-4o-mini", temperature=0.3, max_tokens=4000)
        
        print(f"✅ OpenRouter responded")
        
        content = result['choices'][0]['message']['content']
        print(f"📄 Raw AI response: {content[:200]}...")
        
        analysis_data = extract_json_from_response(content)
        
        # Validate and ensure required fields exist
        if not isinstance(analysis_data, dict):
            raise ValueError("AI response is not a valid dictionary")
        
        if not analysis_data.get('best_match'):
            print(f"⚠️  Missing best_match, creating fallback")
            analysis_data['best_match'] = {
                "job_id": request.jobs[0].id,
                "job_title": request.jobs[0].title,
                "match_score": 0,
                "strengths": ["Không thể phân tích - vui lòng thử lại"],
                "weaknesses": ["Lỗi hệ thống"],
                "recommendation": "Vui lòng thử lại sau."
            }
        
        if not analysis_data.get('all_matches'):
            print(f"⚠️  Missing all_matches, creating from best_match")
            analysis_data['all_matches'] = [analysis_data['best_match']]
        
        if 'overall_score' not in analysis_data:
            analysis_data['overall_score'] = analysis_data.get('best_match', {}).get('match_score', 0)
        
        print(f"✅ Overall score: {analysis_data.get('overall_score', 'N/A')}")
        print(f"🎯 Best match: {analysis_data.get('best_match', {}).get('job_title', 'N/A')}")
        print(f"📊 All matches: {len(analysis_data.get('all_matches', []))}")
        print(f"===== CV-JOB MATCHING END =====\n")
        
        return {
            "success": True,
            "data": analysis_data,
            "message": "CV-Job matching completed",
            "metadata": {"model": "gpt-4o-mini", "jobs_analyzed": len(request.jobs)}
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error matching: {str(e)}")

class GenerateJobDescriptionRequest(BaseModel):
    title: str
    level: str
    department: str
    work_location: Optional[str] = None
    job_type: Optional[str] = None
    language: str = "vietnamese"
    keywords: Optional[str] = None

@app.post("/api/generate-job-description")
async def generate_job_description(request: GenerateJobDescriptionRequest):
    try:
        print(f"\n🎯 ===== GENERATING JOB DESCRIPTION =====")
        print(f"📋 Title: {request.title}")
        
        job_context = f"""Job Position: {request.title}
Department: {request.department}
Level: {request.level}
Job Type: {request.job_type or 'Full-time'}
Location: {request.work_location or 'Remote'}"""
        
        if request.keywords:
            job_context += f"\nRequired Skills: {request.keywords}"
        
        lang_instruction = "Write the job description in Vietnamese language." if request.language == "vietnamese" else "Write the job description in English language."
        
        messages = [
            {"role": "system", "content": f"You are a professional HR specialist. {lang_instruction} Return ONLY valid JSON."},
            {"role": "user", "content": f"""Create a detailed job description:

{job_context}

Return JSON:
{{
  "description": "Detailed job description (150-250 words)",
  "requirements": "• Requirement 1\\n• Requirement 2\\n...",
  "benefits": "• Benefit 1\\n• Benefit 2\\n..."
}}"""}
        ]
        
        result = call_openrouter_api(messages=messages, model="openai/gpt-4o-mini", temperature=0.7, max_tokens=2000)
        
        content = result['choices'][0]['message']['content']
        job_data = extract_json_from_response(content)
        
        if not all(key in job_data for key in ['description', 'requirements', 'benefits']):
            raise HTTPException(status_code=500, detail="Invalid AI response structure")
        
        print(f"✅ Generated job description successfully")
        print(f"===== JOB DESCRIPTION GENERATION END =====\n")
        
        return {
            "success": True,
            "data": job_data,
            "message": "Job description generated successfully",
            "metadata": {"model": "gpt-4o-mini", "language": request.language}
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating job description: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 Starting on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")