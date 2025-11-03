"""
Backend API for CV Management System
Uses OpenRouter AI for both CV parsing and job matching
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

# Load environment variables
load_dotenv()

# Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY not found in environment variables")

# Initialize FastAPI
app = FastAPI(
    title="CV Management API",
    description="API for parsing CVs and matching with jobs using OpenRouter AI",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== PYDANTIC MODELS ====================

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

class MatchCVJobsRequest(BaseModel):
    cv_text: str
    cv_data: CVData
    jobs: List[JobData]
    primary_job_id: Optional[str] = None

# ==================== HELPER FUNCTIONS ====================

def call_openrouter_api(messages: List[dict], model: str = "openai/gpt-4o-mini", temperature: float = 0.7, max_tokens: int = 4000) -> dict:
    """Call OpenRouter API with error handling"""
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
    """Extract JSON from AI response, handling markdown code blocks"""
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
            raise HTTPException(
                status_code=500,
                detail=f"Failed to parse AI response as JSON: {str(e)}"
            )

# ==================== API ENDPOINTS ====================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "CV Management API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "openrouter_configured": bool(OPENROUTER_API_KEY)
    }

@app.post("/api/parse-cv")
async def parse_cv(
    file: UploadFile = File(None, description="CV file (primary parameter)"),
    cv_file: UploadFile = File(None, description="CV file (legacy parameter)")
):
    """
    Parse CV file (PDF or DOCX) - Supports both 'file' and 'cv_file' parameters
    """
    try:
        upload_file = file if file else cv_file
        
        if not upload_file:
            raise HTTPException(
                status_code=422,
                detail="No file provided. Upload a CV file using 'file' or 'cv_file' parameter."
            )
        
        print(f"\n📄 ===== CV PARSING START =====")
        print(f"📎 File: {upload_file.filename}")
        
        if not upload_file.filename.endswith(('.pdf', '.doc', '.docx')):
            raise HTTPException(
                status_code=400,
                detail="Unsupported file format. Only PDF and DOCX are supported."
            )
        
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
            raise HTTPException(
                status_code=400,
                detail="Could not extract text from CV."
            )
        
        print(f"✅ Extracted {len(cv_text)} characters")
        
        ai_input_text = cv_text[:4000] if len(cv_text) > 4000 else cv_text
        
        print(f"🤖 Calling OpenRouter AI...")
        
        messages = [
            {
                "role": "system",
                "content": "You are a professional CV parser. Extract structured information. Return ONLY valid JSON."
            },
            {
                "role": "user",
                "content": f"""Parse this CV and return JSON:

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
}}"""
            }
        ]
        
        result = call_openrouter_api(
            messages=messages,
            model="openai/gpt-4o-mini",
            temperature=0.3,
            max_tokens=2000
        )
        
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
            "metadata": {
                "model": "gpt-4o-mini",
                "filename": upload_file.filename
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error parsing CV: {str(e)}")

@app.post("/api/match-cv-jobs")
async def match_cv_jobs(request: MatchCVJobsRequest):
    """Match CV with jobs using OpenRouter AI"""
    try:
        print(f"\n🎯 ===== CV-JOB MATCHING START =====")
        print(f"👤 Candidate: {request.cv_data.full_name}")
        print(f"📋 Jobs to analyze: {len(request.jobs)}")
        
        jobs_context = []
        for job in request.jobs:
            is_primary = job.id == request.primary_job_id
            job_info = f"""{'⭐ PRIMARY - ' if is_primary else ''}Job {job.id}:
- Title: {job.title}
- Level: {job.level or 'N/A'}
- Requirements: {job.requirements or 'N/A'}"""
            jobs_context.append(job_info)
        
        jobs_text = "\n\n".join(jobs_context)
        
        cv_context = f"""CV: {request.cv_data.full_name}
Email: {request.cv_data.email}
Experience: {request.cv_data.experience or 'N/A'}
Education: {request.cv_data.education or 'N/A'}
Full Text: {request.cv_text[:2000]}"""
        
        messages = [
            {
                "role": "system",
                "content": "You are an HR expert. Analyze CVs and match with jobs. Return ONLY valid JSON."
            },
            {
                "role": "user",
                "content": f"""Analyze this CV and match with jobs:

{cv_context}

JOBS:
{jobs_text}

Return JSON:
{{
  "overall_score": 85,
  "best_match": {{
    "job_id": "uuid",
    "job_title": "title",
    "match_score": 92,
    "strengths": ["strength1", "strength2", "strength3"],
    "weaknesses": ["weakness1"],
    "recommendation": "detailed text"
  }},
  "all_matches": [...]
}}"""
            }
        ]
        
        print(f"🤖 Calling OpenRouter AI...")
        
        result = call_openrouter_api(
            messages=messages,
            model="openai/gpt-4o-mini",
            temperature=0.7,
            max_tokens=4000
        )
        
        print(f"✅ OpenRouter responded")
        
        content = result['choices'][0]['message']['content']
        analysis_data = extract_json_from_response(content)
        
        print(f"✅ Overall score: {analysis_data.get('overall_score', 'N/A')}")
        print(f"===== CV-JOB MATCHING END =====\n")
        
        return {
            "success": True,
            "data": analysis_data,
            "message": "CV-Job matching completed",
            "metadata": {
                "model": "gpt-4o-mini",
                "jobs_analyzed": len(request.jobs)
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error matching: {str(e)}")
    
# ==================== ADD THIS NEW ENDPOINT ====================

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
    Generate job description using OpenRouter AI
    """
    try:
        print(f"\n🎯 ===== GENERATING JOB DESCRIPTION =====")
        print(f"📋 Title: {request.title}")
        print(f"🏢 Department: {request.department}")
        print(f"📊 Level: {request.level}")
        
        # Build context for AI
        job_context = f"""Job Position: {request.title}
Department: {request.department}
Level: {request.level}
Job Type: {request.job_type or 'Full-time'}
Location: {request.work_location or 'Remote'}"""
        
        if request.keywords:
            job_context += f"\nRequired Skills: {request.keywords}"
        
        # Determine language
        lang_instruction = ""
        if request.language == "vietnamese":
            lang_instruction = "Write the job description in Vietnamese language."
        else:
            lang_instruction = "Write the job description in English language."
        
        # Prepare prompt
        messages = [
            {
                "role": "system",
                "content": f"""You are a professional HR specialist and job description writer. 
Create comprehensive, engaging, and professional job descriptions.
{lang_instruction}
Return ONLY valid JSON without any additional text."""
            },
            {
                "role": "user",
                "content": f"""Create a detailed job description for this position:

{job_context}

Generate a professional job description with 3 sections:

1. **Job Description**: Detailed overview of the role, responsibilities, and what the candidate will be doing (150-250 words)

2. **Requirements**: List of required skills, qualifications, and experience (8-12 bullet points)

3. **Benefits**: Attractive benefits and perks offered (6-10 bullet points)

Return ONLY valid JSON in this exact format:
{{
  "description": "Detailed job description here...",
  "requirements": "• Requirement 1\\n• Requirement 2\\n• Requirement 3\\n...",
  "benefits": "• Benefit 1\\n• Benefit 2\\n• Benefit 3\\n..."
}}

Make it professional, engaging, and tailored to the {request.level} level in {request.department} department."""
            }
        ]
        
        print(f"🤖 Calling OpenRouter AI...")
        
        # Call OpenRouter API
        result = call_openrouter_api(
            messages=messages,
            model="openai/gpt-4o-mini",
            temperature=0.7,
            max_tokens=2000
        )
        
        print(f"✅ OpenRouter responded")
        
        # Extract and parse response
        content = result['choices'][0]['message']['content']
        job_data = extract_json_from_response(content)
        
        # Validate response structure
        if not all(key in job_data for key in ['description', 'requirements', 'benefits']):
            raise HTTPException(
                status_code=500,
                detail="Invalid AI response structure. Missing required fields."
            )
        
        print(f"✅ Generated job description successfully")
        print(f"  - Description: {len(job_data['description'])} chars")
        print(f"  - Requirements: {len(job_data['requirements'])} chars")
        print(f"  - Benefits: {len(job_data['benefits'])} chars")
        print(f"===== JOB DESCRIPTION GENERATION END =====\n")
        
        return {
            "success": True,
            "data": job_data,
            "message": "Job description generated successfully",
            "metadata": {
                "model": "gpt-4o-mini",
                "tokens_used": result.get('usage', {}),
                "language": request.language
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error generating job description: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating job description: {str(e)}"
        )    

# ==================== MAIN ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")