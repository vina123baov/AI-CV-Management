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

# ✅ FIXED: Không raise error, chỉ warning để app vẫn start được
if not OPENROUTER_API_KEY:
    print("=" * 60)
    print("⚠️  WARNING: OPENROUTER_API_KEY not found!")
    print("⚠️  Please set this environment variable on Railway")
    print("⚠️  API endpoints will return errors until configured")
    print("=" * 60)

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
    # ✅ FIXED: Check API key trước khi gọi
    if not OPENROUTER_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="OpenRouter API key not configured. Please contact administrator."
        )
    
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
            timeout=30  # ✅ FIXED: Giảm từ 60s xuống 30s
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
    return {
        "message": "CV Management API",
        "version": "1.0.0",
        "status": "running",
        "openrouter_configured": bool(OPENROUTER_API_KEY)
    }

@app.get("/health")
async def health_check():
    """
    ✅ FIXED: Simple healthcheck for Railway
    Không test external API để tránh timeout
    """
    return {
        "status": "healthy",
        "service": "ai-cv-backend",
        "openrouter_configured": bool(OPENROUTER_API_KEY)
    }

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
{request.cv_text[:4000]}"""
        
        messages = [
            {
                "role": "system",
                "content": """Bạn là chuyên gia HR với 15+ năm kinh nghiệm. Phân tích CV và matching với công việc. Return ONLY valid JSON."""
            },
            {
                "role": "user",
                "content": f"""Phân tích CV và matching với các công việc:

{cv_context}

{jobs_text}

Trả về JSON:
{{
  "overall_score": 85,
  "best_match": {{
    "job_id": "uuid",
    "job_title": "Tên công việc",
    "match_score": 88,
    "strengths": ["điểm mạnh 1", "điểm mạnh 2"],
    "weaknesses": ["điểm yếu 1", "điểm yếu 2"],
    "recommendation": "Nhận xét chi tiết"
  }},
  "all_matches": [...]
}}"""
            }
        ]
        
        print(f"🤖 Calling OpenRouter AI...")
        
        result = call_openrouter_api(messages=messages, model="openai/gpt-4o-mini", temperature=0.3, max_tokens=4000)
        
        print(f"✅ OpenRouter responded")
        
        content = result['choices'][0]['message']['content']
        analysis_data = extract_json_from_response(content)
        
        # Validate required fields
        if not isinstance(analysis_data, dict):
            raise ValueError("AI response is not a valid dictionary")
        
        if not analysis_data.get('best_match'):
            analysis_data['best_match'] = {
                "job_id": request.jobs[0].id,
                "job_title": request.jobs[0].title,
                "match_score": 0,
                "strengths": ["Không thể phân tích"],
                "weaknesses": ["Lỗi hệ thống"],
                "recommendation": "Vui lòng thử lại."
            }
        
        if not analysis_data.get('all_matches'):
            analysis_data['all_matches'] = [analysis_data['best_match']]
        
        if 'overall_score' not in analysis_data:
            analysis_data['overall_score'] = analysis_data.get('best_match', {}).get('match_score', 0)
        
        print(f"✅ Overall score: {analysis_data.get('overall_score', 'N/A')}")
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
        
        lang_instruction = "Write in Vietnamese." if request.language == "vietnamese" else "Write in English."
        
        messages = [
            {"role": "system", "content": f"You are a professional HR specialist. {lang_instruction} Return ONLY valid JSON."},
            {"role": "user", "content": f"""Create job description:

{job_context}

Return JSON:
{{
  "description": "Detailed description",
  "requirements": "• Requirement 1\\n• Requirement 2",
  "benefits": "• Benefit 1\\n• Benefit 2"
}}"""}
        ]
        
        result = call_openrouter_api(messages=messages, model="openai/gpt-4o-mini", temperature=0.7, max_tokens=2000)
        
        content = result['choices'][0]['message']['content']
        job_data = extract_json_from_response(content)
        
        if not all(key in job_data for key in ['description', 'requirements', 'benefits']):
            raise HTTPException(status_code=500, detail="Invalid AI response")
        
        print(f"✅ Generated successfully")
        print(f"===== END =====\n")
        
        return {
            "success": True,
            "data": job_data,
            "message": "Job description generated",
            "metadata": {"model": "gpt-4o-mini"}
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    import os
    
    port = int(os.getenv("PORT", 8000))
    
    print(f"\n{'='*60}")
    print(f"🚀 Starting AI CV Management Backend")
    print(f"🌐 Host: 0.0.0.0:{port}")
    print(f"{'='*60}\n")
    
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")