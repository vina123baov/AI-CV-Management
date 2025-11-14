"""
Backend API for CV Management System
Uses OpenRouter AI for both CV parsing and job matching
✅ UPDATED: Enhanced AI prompt for comprehensive extraction
- Experience: Extracted from ALL sources (summary, projects, achievements)
- Skills: Aggregated from entire CV, deduplicated
- Education: Includes degrees, certifications, and qualifications from all sections
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
    """
    ✅ ENHANCED VERSION - Comprehensive CV parsing with improved extraction
    
    Improvements:
    - Experience: Extracted from summary, projects, achievements, not just "Experience" section
    - Skills: Aggregated from all mentions throughout CV, deduplicated
    - Education: Includes degrees, certifications, qualifications from all sections
    """
    try:
        upload_file = file if file else cv_file
        
        if not upload_file:
            raise HTTPException(status_code=422, detail="No file provided")
        
        print(f"\n�� ===== CV PARSING START (ENHANCED) =====")
        print(f"�� File: {upload_file.filename}")
        
        if not upload_file.filename.endswith(('.pdf', '.doc', '.docx')):
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        file_content = await upload_file.read()
        if not file_content:
            raise HTTPException(status_code=400, detail="File is empty")
        
        print(f"�� File size: {len(file_content)/1024:.2f} KB")
        
        cv_text = ""
        
        if upload_file.filename.endswith('.pdf'):
            print("�� Parsing PDF...")
            pdf_file = io.BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            for page_num, page in enumerate(pdf_reader.pages):
                text = page.extract_text()
                if text:
                    cv_text += text + "\n"
                    print(f"  ✓ Page {page_num + 1}: {len(text)} chars")
        
        elif upload_file.filename.endswith(('.doc', '.docx')):
            print("�� Parsing DOCX...")
            doc_file = io.BytesIO(file_content)
            doc = Document(doc_file)
            cv_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        
        if not cv_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from CV")
        
        print(f"✅ Extracted {len(cv_text)} characters")
        
        ai_input_text = cv_text[:4000] if len(cv_text) > 4000 else cv_text
        
        print(f"�� Calling OpenRouter AI with ENHANCED prompt...")
        
        # ✅ ENHANCED PROMPT - Comprehensive extraction from entire CV
        messages = [
            {
                "role": "system", 
                "content": """You are an expert CV parser with deep understanding of resume formats and recruitment practices.

CORE PRINCIPLES:
1. Extract information from ENTIRE CV, not just labeled sections
2. Look for implicit mentions and context clues
3. Aggregate information from multiple sources
4. Deduplicate and organize information logically
5. Return ONLY valid JSON with no markdown formatting"""
            },
            {
                "role": "user", 
                "content": f"""Parse this CV comprehensively and extract ALL relevant information from every section:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CV CONTENT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{ai_input_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPREHENSIVE EXTRACTION GUIDELINES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. FULL NAME:
   - Usually at the very top (first 3-5 lines)
   - Format: 2-5 capitalized words
   - Exclude: email, phone, addresses, titles
   - Example: "JOHN MICHAEL DOE" or "Nguyễn Văn An"

2. CONTACT INFORMATION:
   �� EMAIL: xxx@domain.com format
   �� PHONE: Various formats (+84, 0, international codes)
   �� ADDRESS: Full or partial address, city, country

3. EDUCATION & QUALIFICATIONS - ⚠️ COMPREHENSIVE EXTRACTION:
   
   ✅ Extract from ALL these sources:
   
   A. Traditional "Education" section:
      - University/College name and location
      - Degree (Bachelor's, Master's, PhD, Associate, Diploma)
      - Major/Field of study
      - GPA if mentioned
      - Graduation year or attendance period
      - Academic achievements, honors
   
   B. Certifications & Licenses (often separate section or mixed with education):
      - Professional certifications (AWS Certified, PMP, Google Analytics, etc.)
      - Industry certifications (CompTIA, Cisco, Microsoft, etc.)
      - Language certifications (IELTS, TOEFL, HSK, JLPT)
      - Training certificates
      - Online course completions (Coursera, Udemy certificates if mentioned)
      - Professional licenses (CPA, PE, Medical licenses)
   
   C. Scattered qualifications throughout CV:
      - In Summary/Profile: "MBA graduate", "Certified Developer"
      - In Experience: "Completed X certification while working"
      - In Skills: "AWS Certified Solutions Architect"
      - Footer or header notes about credentials
   
   D. Academic background indicators:
      - Coursework mentions
      - Research projects
      - Thesis or dissertation titles
      - Academic publications
   
   COMBINE ALL into comprehensive "education" field:
   - Start with formal degrees (most recent first)
   - Then add certifications and licenses
   - Include completion dates when available
   - Mention GPA, honors, relevant coursework
   - Format naturally as a paragraph or organized list
   
   Example output:
   "Bachelor of Science in Computer Science, Stanford University (2018-2022), GPA: 3.8/4.0, Magna Cum Laude. 
   AWS Certified Solutions Architect Professional (2023). 
   Google Cloud Professional Data Engineer (2023). 
   IELTS Academic: 7.5 (2022). 
   Completed Advanced Machine Learning Specialization, Coursera (2023)."

4. UNIVERSITY (Specific institution name):
   - Extract the primary university/college name
   - Example: "Stanford University" or "Đại học Bách Khoa Hà Nội"
   - If multiple institutions, use the most recent or highest degree institution

5. EXPERIENCE - ⚠️ COMPREHENSIVE EXTRACTION:
   
   ✅ Extract from ALL these sources:
   
   A. Traditional "Experience" / "Work History" section:
      - Job titles, company names, dates
      - Responsibilities and achievements
      - Technologies and tools used
      - Team size, leadership roles
      - Measurable results (increased by X%, reduced by Y)
   
   B. Summary/Objective/Profile (top of CV):
      - Years of experience mentioned: "5+ years in software development"
      - Industry expertise: "specialized in fintech applications"
      - Leadership experience: "led cross-functional teams"
      - Key achievements highlighted
   
   C. Projects section:
      - Personal projects with technologies used
      - Academic projects demonstrating skills
      - Freelance work
      - Open-source contributions
   
   D. Achievements/Awards section:
      - Professional accomplishments
      - Recognition and awards that indicate experience level
   
   E. Volunteer work and internships:
      - Relevant volunteer experience
      - Internship experiences
   
   COMBINE ALL mentions into ONE comprehensive experience narrative:
   - Preserve chronological sense where possible
   - Include summary statements about total years of experience
   - Mention specific companies, roles, and durations
   - Highlight key technologies, achievements, and responsibilities
   - Keep quantifiable results (percentages, numbers, metrics)
   
   Example output:
   "Experienced software engineer with 6+ years building scalable web applications. 
   Senior Full-Stack Developer at TechCorp Inc. (2021-2024): Led team of 5 developers, 
   architected microservices handling 1M+ daily requests, reduced API latency by 40%. 
   Software Developer at StartupXYZ (2018-2021): Developed e-commerce platform using 
   MERN stack serving 50K+ users, implemented CI/CD pipeline reducing deployment time by 60%. 
   Personal Projects: Built open-source React component library with 2K+ GitHub stars, 
   developed mobile app using React Native with 10K+ downloads."

6. SKILLS - ⚠️ COMPREHENSIVE EXTRACTION & AGGREGATION:
   
   ✅ Extract from ALL these sources:
   
   A. Traditional "Skills" / "Technical Skills" section
   B. Experience descriptions (technologies mentioned in job descriptions)
   C. Projects section (frameworks and tools used)
   D. Education section (programming languages taught, tools learned)
   E. Summary/Profile (self-described expertise)
   F. Certifications (implies proficiency in certified technology)
   G. Tools/Technologies subsections
   
   What to capture:
   - Programming languages: JavaScript, Python, Java, C++, etc.
   - Frameworks & libraries: React, Vue, Django, Spring Boot, etc.
   - Databases: MySQL, PostgreSQL, MongoDB, Redis, etc.
   - Cloud platforms: AWS, Azure, GCP, Heroku, etc.
   - DevOps tools: Docker, Kubernetes, Jenkins, CI/CD, etc.
   - Design tools: Figma, Photoshop, Sketch, etc.
   - Soft skills IF clearly stated: Leadership, Communication, Agile, etc.
   - Domain expertise: Machine Learning, Data Science, DevOps, etc.
   - Methodologies: Agile, Scrum, TDD, Microservices, etc.
   
   CRITICAL: 
   - Aggregate ALL skill mentions from entire CV
   - DEDUPLICATE (remove duplicates)
   - Normalize similar terms: "nodejs" = "Node.js", "reactjs" = "React"
   - Return as ARRAY of distinct skill strings
   - Preserve proper capitalization: "JavaScript" not "javascript"
   
   Example output:
   ["JavaScript", "TypeScript", "React", "Node.js", "Python", "Django", 
   "PostgreSQL", "MongoDB", "AWS", "Docker", "Kubernetes", "Git", "CI/CD", 
   "Agile", "Microservices", "REST API", "GraphQL", "Machine Learning", 
   "TensorFlow", "Leadership", "Team Management"]

7. SUMMARY/PROFILE:
   - Usually at top of CV
   - Section headers: "Summary", "Objective", "Profile", "About Me", "Professional Summary"
   - Brief overview of career (typically 50-200 words)
   - Career goals, highlights, key strengths
   - If no explicit summary section exists, leave as null

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETURN THIS EXACT JSON STRUCTURE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{
  "full_name": "string or null",
  "email": "string or null",
  "phone_number": "string or null",
  "address": "string or null",
  "university": "string or null",
  "education": "COMPREHENSIVE education including degrees, certifications, licenses, courses - combined from all sections",
  "experience": "COMPREHENSIVE experience from ALL sources - summary mentions + work history + projects + achievements",
  "skills": ["skill1", "skill2", "skill3", ...] or [],
  "summary": "string or null"
}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL REMINDERS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ EDUCATION: Include degrees + certifications + licenses + training from ENTIRE CV
✅ EXPERIENCE: Scan ENTIRE CV including summary, projects, achievements
✅ SKILLS: Aggregate from ALL sections, deduplicate, normalize
✅ Preserve original language (Vietnamese or English as written)
✅ Return valid JSON only, no markdown, no extra text, no explanations
✅ If field not found after thorough search, use null or []
✅ Be thorough - scan every section, every paragraph for relevant information"""
            }
        ]
        
        result = call_openrouter_api(
            messages=messages, 
            model="openai/gpt-4o-mini", 
            temperature=0.3,  # Low temperature for consistency
            max_tokens=2000
        )
        
        print(f"✅ OpenRouter responded")
        
        content = result['choices'][0]['message']['content']
        parsed_data = extract_json_from_response(content)
        parsed_data['fullText'] = cv_text
        
        # ✅ Log extraction statistics
        print(f"�� Extraction Statistics:")
        print(f"  ├─ Name: {parsed_data.get('full_name', 'N/A')}")
        print(f"  ├─ Email: {parsed_data.get('email', 'N/A')}")
        print(f"  ├─ Skills extracted: {len(parsed_data.get('skills', []))} skills")
        print(f"  ├─ Experience length: {len(str(parsed_data.get('experience', '')))} chars")
        print(f"  ├─ Education length: {len(str(parsed_data.get('education', '')))} chars")
        print(f"  └─ University: {parsed_data.get('university', 'N/A')}")
        
        if parsed_data.get('skills'):
            print(f"  └─ Skills preview: {', '.join(parsed_data.get('skills', [])[:10])}...")
        
        print(f"===== CV PARSING END (ENHANCED) =====\n")
        
        return {
            "success": True,
            "data": parsed_data,
            "message": "CV parsed successfully with enhanced comprehensive extraction",
            "metadata": {
                "model": "gpt-4o-mini",
                "filename": upload_file.filename,
                "enhanced_prompt": True,
                "version": "2.0-comprehensive"
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error parsing CV: {str(e)}")

@app.post("/api/match-cv-jobs")
async def match_cv_jobs(request: MatchCVJobsRequest):
    """
    Match CV with multiple job positions using AI analysis
    ✅ UNCHANGED - Only parse-cv endpoint was modified
    """
    try:
        print(f"\n�� ===== CV-JOB MATCHING START =====")
        print(f"�� CV: {request.cv_data.full_name}")
        print(f"�� Jobs to match: {len(request.jobs)}")
        if request.primary_job_id:
            print(f"⭐ Primary job: {request.primary_job_id}")
        
        cv_context = f"""
CANDIDATE INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: {request.cv_data.full_name}
Email: {request.cv_data.email}
Phone: {request.cv_data.phone_number or 'N/A'}
Address: {request.cv_data.address or 'N/A'}

EDUCATION:
{request.cv_data.education or 'Not specified'}

UNIVERSITY:
{request.cv_data.university or 'Not specified'}

WORK EXPERIENCE:
{request.cv_data.experience or 'Not specified'}

FULL CV TEXT (for additional context):
{request.cv_text[:2000]}
"""
        
        jobs_text = ""
        for idx, job in enumerate(request.jobs, 1):
            is_primary = "⭐ PRIMARY JOB" if job.id == request.primary_job_id else ""
            jobs_text += f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JOB {idx}: {job.title} {is_primary}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ID: {job.id}
Title: {job.title}
Level: {job.level or 'N/A'}
Department: {job.department or 'N/A'}
Job Type: {job.job_type or 'N/A'}
Work Location: {job.work_location or 'N/A'}
Location: {job.location or 'N/A'}

DESCRIPTION:
{job.description or 'N/A'}

REQUIREMENTS:
{job.requirements or 'N/A'}

MANDATORY REQUIREMENTS (If candidate does NOT meet these, apply -50 penalty):
{job.mandatory_requirements or 'None'}

BENEFITS:
{job.benefits or 'N/A'}

"""
        
        messages = [
            {
                "role": "system",
                "content": """You are an expert recruitment AI specializing in candidate-job matching.

Analyze CV against multiple job positions with precision and fairness.

SCORING SYSTEM (BASE 100 or BASE 50 if mandatory requirements not met):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BƯỚC 1: KIỂM TRA YÊU CẦU BẮT BUỘC (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NẾU có "MANDATORY REQUIREMENTS":
1. Đọc KỸ từng yêu cầu bắt buộc
2. Tìm bằng chứng trong CV:
   - university field
   - education field  
   - experience field
   - fullText field
3. NẾU ứng viên ĐÁP ỨNG → Tiếp tục chấm trên BASE 100
4. NẾU ứng viên KHÔNG ĐÁP ỨNG → Áp dụng PENALTY -50 điểm NGAY

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BƯỚC 2A: CHẤM ĐIỂM TRÊN BASE 100 (Nếu ĐÁP ỨNG bắt buộc)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phân bổ điểm (Tổng = 100):
- Kinh nghiệm phù hợp: 0-30 điểm
- Kỹ năng kỹ thuật: 0-25 điểm
- Học vấn phù hợp: 0-15 điểm
- Level/Seniority match: 0-15 điểm
- Địa điểm phù hợp: 0-10 điểm
- Kỹ năng mềm: 0-5 điểm

Điểm cuối = Tổng (0-100)
Điểm yếu: Các điểm yếu thông thường (KHÔNG liên quan mandatory)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BƯỚC 2B: ÁP DỤNG PENALTY VÀ CHẤM TRÊN BASE 50 (Nếu KHÔNG đáp ứng bắt buộc)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUAN TRỌNG: Với JOB ⭐ PRIMARY (job ứng viên đã apply):
- Đánh giá CHI TIẾT HỖN hơn
- Đây là job ứng viên QUAN TÂM - phải đánh giá kỹ lưỡng
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
        
        print(f"�� Calling OpenRouter AI...")
        
        result = call_openrouter_api(messages=messages, model="openai/gpt-4o-mini", temperature=0.3, max_tokens=4000)
        
        print(f"✅ OpenRouter responded")
        
        content = result['choices'][0]['message']['content']
        print(f"�� Raw AI response: {content[:200]}...")
        
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
        print(f"�� Best match: {analysis_data.get('best_match', {}).get('job_title', 'N/A')}")
        print(f"�� All matches: {len(analysis_data.get('all_matches', []))}")
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
    """
    Generate job description using AI
    ✅ UNCHANGED - Only parse-cv endpoint was modified
    """
    try:
        print(f"\n�� ===== GENERATING JOB DESCRIPTION =====")
        print(f"�� Title: {request.title}")
        
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
    port = int(os.getenv("PORT", 8000))  # Đọc PORT từ Railway
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")