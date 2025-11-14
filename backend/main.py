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
import logging  # THÊM: Để log debug/error dễ dàng hơn

# THÊM: Setup logging cơ bản
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    allow_origins=["*"],  # THÊM: Cho phép tất cả origins, nhưng production nên restrict (ví dụ: ["https://your-frontend.com"])
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
    try:  # THÊM: Wrap để catch error nếu cần
        return {"message": "CV Management API", "version": "1.0.0", "status": "running"}
    except Exception as e:
        logger.error(f"Root endpoint error: {str(e)}")  # THÊM: Log error
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "openrouter_configured": bool(OPENROUTER_API_KEY)}

@app.post("/api/parse-cv")
async def parse_cv(file: UploadFile = File(None), cv_file: UploadFile = File(None)):
    try:
        upload_file = file if file else cv_file
        
        if not upload_file:
            raise HTTPException(status_code=422, detail="No file provided")
        
        logger.info(f"CV PARSING START - File: {upload_file.filename}")  # THÊM: Log info
        
        if not upload_file.filename.endswith(('.pdf', '.doc', '.docx')):
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        file_content = await upload_file.read()
        if not file_content:
            raise HTTPException(status_code=400, detail="File is empty")
        
        logger.info(f"File size: {len(file_content)/1024:.2f} KB")  # THÊM: Log
        
        cv_text = ""
        
        if upload_file.filename.endswith('.pdf'):
            logger.info("Parsing PDF...")
            pdf_file = io.BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            for page_num, page in enumerate(pdf_reader.pages):
                text = page.extract_text()
                if text:
                    cv_text += text + "\n"
                    logger.info(f"Page {page_num + 1}: {len(text)} chars")  # THÊM: Log
        
        elif upload_file.filename.endswith(('.doc', '.docx')):
            logger.info("Parsing DOCX...")
            doc_file = io.BytesIO(file_content)
            doc = Document(doc_file)
            cv_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        
        if not cv_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from CV")
        
        logger.info(f"Extracted {len(cv_text)} characters")
        
        ai_input_text = cv_text[:4000] if len(cv_text) > 4000 else cv_text
        
        logger.info("Calling OpenRouter AI...")
        
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
        
        logger.info("OpenRouter responded")
        
        content = result['choices'][0]['message']['content']
        parsed_data = extract_json_from_response(content)
        parsed_data['fullText'] = cv_text
        
        logger.info(f"Parsed: {parsed_data.get('full_name', 'N/A')}")
        logger.info("CV PARSING END")
        
        return {
            "success": True,
            "data": parsed_data,
            "message": "CV parsed successfully",
            "metadata": {"model": "gpt-4o-mini", "filename": upload_file.filename}
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error parsing CV: {str(e)}")  # THÊM: Log error
        raise HTTPException(status_code=500, detail=f"Error parsing CV: {str(e)}")

# Các endpoint khác giữ nguyên, chỉ thêm logger.info/logger.error tương tự nếu cần debug sâu hơn

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Starting on port {port}")  # THÊM: Log start
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")