// src/utils/advancedCVParser.ts
import mammoth from 'mammoth';

let pdfjsLib: any = null;

if (typeof window !== 'undefined') {
  import('pdfjs-dist').then((pdfjs) => {
    pdfjsLib = pdfjs;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  });
}

export interface ParsedCV {
  fullText: string;
  email?: string;
  phone?: string;
  address?: string;
  name?: string;
  skills?: string[];
  experience?: string;
  education?: string;
  university?: string;
  certifications?: string[];
  languages?: string[];
  summary?: string;
  parseQuality: 'excellent' | 'good' | 'fair' | 'poor';
  extractedFields: string[];
  warnings?: string[];
}

async function parsePDF(file: File): Promise<string> {
  if (!pdfjsLib) {
    throw new Error('PDF parser chưa sẵn sàng. Vui lòng thử lại.');
  }
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Không thể đọc file PDF. Vui lòng thử file khác.');
  }
}

async function parseDOCX(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('DOCX parsing error:', error);
    throw new Error('Không thể đọc file DOCX. Vui lòng thử file khác.');
  }
}

async function parseDOC(file: File): Promise<string> {
  try {
    const text = await file.text();
    return text.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');
  } catch (error) {
    throw new Error('Không thể đọc file DOC. Vui lòng chuyển sang DOCX.');
  }
}

async function parseTXT(file: File): Promise<string> {
  return await file.text();
}

function extractEmail(text: string): string | undefined {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailRegex);
  return emails?.[0]?.toLowerCase();
}

function extractPhone(text: string): string | undefined {
  const phonePatterns = [
    /(?:\+84|84|0)[\s.-]?([0-9]{2,3})[\s.-]?([0-9]{3})[\s.-]?([0-9]{3,4})/g,
    /\b0[0-9]{9,10}\b/g,
    /\b\+84[0-9]{9,10}\b/g
  ];
  
  for (const pattern of phonePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      return matches[0].replace(/[\s.-]/g, '');
    }
  }
  return undefined;
}

function extractName(text: string): string | undefined {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // Method 1: Tìm tên ở 5 dòng đầu (chữ hoa, không có số, không có @)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    const words = line.split(/\s+/);
    
    if (words.length >= 2 && words.length <= 5) {
      const hasNumbers = /\d/.test(line);
      const hasEmail = /@/.test(line);
      const hasSpecialChars = /[#§$%^&*()]/.test(line);
      const allCapitalized = words.every(w => /^[A-ZÀ-Ý]/.test(w));
      
      if (!hasNumbers && !hasEmail && !hasSpecialChars && allCapitalized) {
        return line;
      }
    }
  }
  
  // Method 2: Fallback - Lấy dòng đầu tiên nếu hợp lý
  const firstLine = lines[0]?.trim();
  if (firstLine && firstLine.length > 5 && firstLine.length < 50 && 
      !firstLine.includes('@') && !firstLine.includes('CV')) {
    return firstLine;
  }
  
  return undefined;
}

function extractAddress(text: string): string | undefined {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Pattern 1: Tìm dòng có số nhà, đường, phường, quận
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Check nếu có street/ward/district keywords VÀ có số
    if (/\d+/.test(line) && (
      lowerLine.includes('street') || lowerLine.includes('ward') || 
      lowerLine.includes('district') || lowerLine.includes('phường') || 
      lowerLine.includes('quận') || lowerLine.includes('đường')
    )) {
      // Đảm bảo không phải email hoặc số điện thoại
      if (!line.includes('@') && !line.includes('+84') && line.length > 20 && line.length < 200) {
        return line;
      }
    }
  }
  
  // Pattern 2: Tìm theo keyword "địa chỉ:"
  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase();
    
    if (lowerLine.includes('địa chỉ:') || lowerLine.includes('address:')) {
      // Lấy phần sau dấu :
      const parts = lines[i].split(/[:：]/);
      if (parts.length > 1 && parts[1].trim().length > 10) {
        return parts[1].trim();
      }
      
      // Hoặc lấy dòng tiếp theo
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.length > 15 && nextLine.length < 200 && !nextLine.includes('@')) {
          return nextLine;
        }
      }
    }
  }
  
  // Pattern 3: Dòng có format "566/35/21 An Duong Vuong Street..."
  for (const line of lines) {
    // Kiểm tra pattern: số/số/số + tên đường
    if (/^\d+\/\d+\/\d+/.test(line) && line.length > 20 && !line.includes('@')) {
      return line;
    }
  }
  
  return undefined;
}

function extractUniversity(text: string): string | undefined {
  const universityKeywords = [
    'university', 'đại học', 'học viện', 'college', 
    'trường', 'institute', 'academy'
  ];
  
  const lines = text.split('\n');
  
  // Method 1: Tìm trong section Education
  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase().trim();
    
    if (lowerLine === 'education' || lowerLine.startsWith('education')) {
      // Lấy 3 dòng tiếp theo
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nextLine = lines[j].trim();
        const nextLower = nextLine.toLowerCase();
        
        if (nextLine.length > 15) {
          // Kiểm tra có university keyword không
          for (const keyword of universityKeywords) {
            if (nextLower.includes(keyword)) {
              return nextLine.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
            }
          }
          
          // Nếu không có keyword nhưng dòng hợp lý (không phải date, major)
          if (!nextLower.includes('major') && 
              !nextLower.includes('bachelor') &&
              !/^\d{4}/.test(nextLine)) {
            return nextLine.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
          }
        }
      }
    }
  }
  
  // Method 2: Tìm theo keyword trực tiếp
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    for (const keyword of universityKeywords) {
      if (lowerLine.includes(keyword) && line.length > 15 && line.length < 200) {
        return line.trim().replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
      }
    }
  }
  
  return undefined;
}

function extractSkills(text: string): string[] {
  const skillDatabase = [
    'javascript', 'typescript', 'python', 'java', 'csharp', 'cpp',
    'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala',
    'react', 'vue', 'angular', 'svelte', 'nextjs', 'nuxt', 'gatsby',
    'html', 'css', 'sass', 'scss', 'tailwind', 'bootstrap',
    'nodejs', 'express', 'nestjs', 'django', 'flask', 'spring', 'laravel',
    'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'firebase',
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins',
    'git', 'github', 'gitlab', 'jira', 'figma', 'photoshop',
    'tensorflow', 'pytorch', 'keras', 'sklearn', 'pandas', 'numpy',
    'restapi', 'graphql', 'microservices', 'agile', 'scrum'
  ];
  
  const textLower = text.toLowerCase().replace(/[.\-_]/g, '');
  const foundSkills = new Set<string>();
  
  for (const skill of skillDatabase) {
    const regex = new RegExp('\\b' + skill + '\\b', 'gi');
    if (regex.test(textLower)) {
      foundSkills.add(skill);
    }
  }
  
  return Array.from(foundSkills);
}

function extractExperience(text: string): string | undefined {
  const experienceKeywords = [
    'experience', 'work experience', 'employment', 
    'kinh nghiệm', 'kinh nghiệm làm việc', 'công việc',
    'projects', 'project', 'dự án', 'experiment'
  ];
  
  const lines = text.split('\n');
  let experienceSection = '';
  let capturing = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase().trim();
    
    // Start capturing
    if (!capturing && experienceKeywords.some(kw => lowerLine.includes(kw))) {
      capturing = true;
      
      // Nếu dòng không chỉ là header, thêm vào
      const isJustHeader = experienceKeywords.some(kw => lowerLine === kw);
      if (!isJustHeader && line.trim().length > 0) {
        experienceSection += line + '\n';
      }
      continue;
    }
    
    // Stop capturing
    if (capturing) {
      const stopKeywords = [
        'education', 'học vấn', 'skills', 'kỹ năng', 
        'certificate', 'chứng chỉ', 'interests', 'sở thích',
        'technologies', 'languages', 'references'
      ];
      
      const isStopLine = stopKeywords.some(kw => lowerLine === kw || 
        (lowerLine.startsWith(kw) && line.length < 50));
      
      // Không dừng ở "Academic" vì nó là sub-section của Projects
      if (isStopLine && !lowerLine.includes('academic')) {
        break;
      }
      
      experienceSection += line + '\n';
    }
  }
  
  const result = experienceSection.trim();
  return result.length > 10 ? result : undefined;
}

function extractEducation(text: string): string | undefined {
  const educationKeywords = [
    'education', 'học vấn', 'academic', 'qualification', 
    'degree', 'major', 'bachelor', 'knowledge', 
    'background knowledge', 'skills & background'
  ];
  
  const lines = text.split('\n');
  let educationSection = '';
  let capturing = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase().trim();
    
    // Start capturing
    if (!capturing && educationKeywords.some(kw => lowerLine.includes(kw))) {
      capturing = true;
      
      // Nếu dòng không chỉ là header, thêm vào
      const isJustHeader = educationKeywords.some(kw => lowerLine === kw);
      if (!isJustHeader && line.trim().length > 0) {
        educationSection += line + '\n';
      }
      continue;
    }
    
    // Stop capturing
    if (capturing) {
      const stopKeywords = [
        'experience', 'kinh nghiệm', 'projects', 'dự án',
        'certificate', 'chứng chỉ', 'interests', 'sở thích',
        'references', 'hobbies'
      ];
      
      const isStopLine = stopKeywords.some(kw => lowerLine === kw || 
        (lowerLine.startsWith(kw) && line.length < 50));
      
      if (isStopLine) {
        break;
      }
      
      educationSection += line + '\n';
    }
  }
  
  const result = educationSection.trim();
  return result.length > 10 ? result : undefined;
}

function extractCertifications(text: string): string[] {
  const certKeywords = [
    'certification', 'certificate', 'chứng chỉ', 
    'certified', 'license', 'award'
  ];
  
  const lines = text.split('\n');
  const certifications: string[] = [];
  let capturing = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();
    
    if (!capturing && certKeywords.some(kw => lowerLine.includes(kw))) {
      capturing = true;
      
      // Nếu dòng hiện tại không chỉ là header
      if (!certKeywords.some(kw => lowerLine === kw) && line.length > 5) {
        certifications.push(line.replace(/^[-•*]\s*/, ''));
      }
      continue;
    }
    
    if (capturing) {
      const stopKeywords = ['experience', 'education', 'skills', 'projects', 'interests'];
      if (stopKeywords.some(kw => lowerLine.includes(kw)) && line.length < 50) {
        break;
      }
      
      if (line.length > 5 && line.length < 150) {
        certifications.push(line.replace(/^[-•*]\s*/, ''));
      }
    }
  }
  
  return certifications;
}

function extractLanguages(text: string): string[] {
  const languageKeywords = [
    'english', 'vietnamese', 'tiếng anh', 'tiếng việt', 
    'chinese', 'japanese', 'korean', 'french', 'german', 'spanish',
    'mandarin', 'cantonese'
  ];
  
  const languages: string[] = [];
  const textLower = text.toLowerCase();
  
  for (const lang of languageKeywords) {
    if (textLower.includes(lang)) {
      const capitalizedLang = lang.charAt(0).toUpperCase() + lang.slice(1);
      languages.push(capitalizedLang);
    }
  }
  
  return [...new Set(languages)];
}

function extractSummary(text: string): string | undefined {
  const summaryKeywords = [
    'summary', 'objective', 'profile', 'about', 
    'tóm tắt', 'mục tiêu', 'giới thiệu'
  ];
  
  const lines = text.split('\n');
  let summarySection = '';
  let capturing = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase().trim();
    
    if (!capturing && summaryKeywords.some(kw => lowerLine.includes(kw))) {
      capturing = true;
      
      // Nếu dòng không chỉ là header
      if (!summaryKeywords.some(kw => lowerLine === kw) && line.trim().length > 10) {
        summarySection += line + ' ';
      }
      continue;
    }
    
    if (capturing) {
      const stopKeywords = ['experience', 'education', 'skills', 'projects'];
      if (stopKeywords.some(kw => lowerLine === kw || lowerLine.startsWith(kw))) {
        break;
      }
      
      summarySection += line + ' ';
      if (summarySection.length > 500) break;
    }
  }
  
  const result = summarySection.trim();
  return result.length > 20 ? result : undefined;
}

function calculateParseQuality(parsed: Partial<ParsedCV>): ParsedCV['parseQuality'] {
  const score = parsed.extractedFields?.length || 0;
  if (score >= 8) return 'excellent';
  if (score >= 5) return 'good';
  if (score >= 3) return 'fair';
  return 'poor';
}

export async function parseCV(file: File): Promise<ParsedCV> {
  let text = '';
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  try {
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      text = await parsePDF(file);
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      text = await parseDOCX(file);
    } else if (fileType === 'application/msword' || fileName.endsWith('.doc')) {
      text = await parseDOC(file);
    } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      text = await parseTXT(file);
    } else {
      throw new Error('Định dạng file không được hỗ trợ');
    }
    
    if (!text || text.trim().length < 50) {
      throw new Error('File trống hoặc không thể đọc được nội dung');
    }
    
    console.log('=== CV PARSING DEBUG ===');
    console.log('Full text length:', text.length);
    console.log('First 500 chars:', text.substring(0, 500));
    
    const extractedFields: string[] = [];
    const warnings: string[] = [];
    
    const email = extractEmail(text);
    console.log('Extracted email:', email);
    if (email) extractedFields.push('email');
    
    const phone = extractPhone(text);
    console.log('Extracted phone:', phone);
    if (phone) extractedFields.push('phone');
    
    const name = extractName(text);
    console.log('Extracted name:', name);
    if (name) extractedFields.push('name');
    
    const address = extractAddress(text);
    console.log('Extracted address:', address);
    if (address) extractedFields.push('address');
    
    const university = extractUniversity(text);
    console.log('Extracted university:', university);
    if (university) extractedFields.push('university');
    
    const skills = extractSkills(text);
    console.log('Extracted skills:', skills);
    if (skills.length > 0) extractedFields.push('skills');
    
    const experience = extractExperience(text);
    console.log('Extracted experience length:', experience?.length || 0);
    console.log('Experience preview:', experience?.substring(0, 200));
    if (experience) extractedFields.push('experience');
    
    const education = extractEducation(text);
    console.log('Extracted education length:', education?.length || 0);
    console.log('Education preview:', education?.substring(0, 200));
    if (education) extractedFields.push('education');
    
    const certifications = extractCertifications(text);
    console.log('Extracted certifications:', certifications);
    if (certifications.length > 0) extractedFields.push('certifications');
    
    const languages = extractLanguages(text);
    console.log('Extracted languages:', languages);
    if (languages.length > 0) extractedFields.push('languages');
    
    const summary = extractSummary(text);
    console.log('Extracted summary length:', summary?.length || 0);
    if (summary) extractedFields.push('summary');
    
    if (!email) warnings.push('Không tìm thấy email');
    if (!phone) warnings.push('Không tìm thấy số điện thoại');
    if (skills.length === 0) warnings.push('Không tìm thấy kỹ năng');
    
    const parsed: ParsedCV = {
      fullText: text,
      email,
      phone,
      name,
      address,
      university,
      skills,
      experience,
      education,
      certifications,
      languages,
      summary,
      extractedFields,
      warnings: warnings.length > 0 ? warnings : undefined,
      parseQuality: 'fair'
    };
    
    parsed.parseQuality = calculateParseQuality(parsed);
    
    console.log('=== FINAL PARSED RESULT ===');
    console.log('Extracted fields:', extractedFields);
    console.log('Quality:', parsed.parseQuality);
    console.log('Parsed data:', parsed);
    console.log('========================');
    
    return parsed;
    
  } catch (error: any) {
    console.error('Error parsing CV:', error);
    throw error;
  }
}

export function validateCVFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain'
  ];
  
  const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
  
  const maxSize = 5 * 1024 * 1024;
  
  if (!allowedTypes.includes(file.type) && !hasValidExtension) {
    return { 
      valid: false, 
      error: 'Chỉ chấp nhận file PDF, DOCX, DOC hoặc TXT' 
    };
  }
  
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: 'File không được vượt quá 5MB' 
    };
  }
  
  if (file.size === 0) {
    return { 
      valid: false, 
      error: 'File rỗng' 
    };
  }
  
  return { valid: true };
}