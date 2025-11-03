// src/utils/cvParser.ts
import mammoth from 'mammoth';

export interface ParsedCV {
  fullText: string;
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  university?: string;
  education?: string;
  experience?: string;
  skills?: string[];
  certifications?: string[];
  languages?: string[];
  summary?: string;
}

// =====================================================
// PARSE FILE FUNCTIONS
// =====================================================

// Parse PDF file using pdfjs-dist
async function parsePDF(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Không thể đọc file PDF');
  }
}

// Parse DOCX file
async function parseDOCX(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    throw new Error('Không thể đọc file DOCX');
  }
}

// Parse TXT file  
async function parseTXT(file: File): Promise<string> {
  try {
    return await file.text();
  } catch (error) {
    console.error('Error parsing TXT:', error);
    throw new Error('Không thể đọc file TXT');
  }
}

// =====================================================
// AI BACKEND INTEGRATION
// =====================================================

async function extractInfoWithAI(file: File): Promise<ParsedCV> {
  console.log('🤖 Đang gọi AI backend để parse CV...');
  
  try {
    // Lấy API URL từ .env
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    
    console.log('📡 API URL:', API_URL);
    
    // Tạo FormData để gửi file
    const formData = new FormData();
    formData.append('file', file);
    
    console.log('📤 Đang gửi file đến backend:', file.name);
    
    // Gọi backend API với timeout 30s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(`${API_URL}/api/parse-cv`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    console.log('📥 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Backend error:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ AI parsing thành công:', result);
    
    if (result.success && result.data) {
      // Map response từ backend về ParsedCV format
      return {
        fullText: result.data.fullText || '',
        fullName: result.data.full_name || undefined,
        email: result.data.email || undefined,
        phone: result.data.phone_number || undefined,
        address: result.data.address || undefined,
        skills: result.data.skills || [],
        experience: result.data.experience || undefined,
        education: result.data.education || undefined,
        university: result.data.university || undefined,
      };
    }
    
    throw new Error('Backend không trả về dữ liệu hợp lệ');
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ AI request timeout sau 30s');
    } else {
      console.error('❌ Lỗi khi gọi AI backend:', error);
    }
    throw error; // Re-throw để fallback về regex
  }
}

// =====================================================
// ADVANCED REGEX PARSING - FALLBACK WHEN AI FAILS
// =====================================================

// ✅ IMPROVED: Extract Full Name - Mạnh mẽ hơn
function extractFullName(text: string): string | undefined {
  console.log('🔍 Extracting full name...');
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Strategy 1: Tìm ở 15 dòng đầu tiên
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i].trim();
    
    // Bỏ qua dòng có các từ khóa không phải tên
    const skipKeywords = [
      'curriculum', 'vitae', 'resume', 'cv', 'profile', 'contact',
      'personal', 'information', 'objective', 'summary', 'education',
      'experience', 'skills', 'projects', 'achievements'
    ];
    
    const lowerLine = line.toLowerCase();
    if (skipKeywords.some(keyword => lowerLine.includes(keyword))) {
      continue;
    }
    
    // Bỏ qua dòng có email, số, hoặc ký tự đặc biệt
    if (/@/.test(line) || /\d{3,}/.test(line) || /[#$%^&*()[\]{}]/.test(line)) {
      continue;
    }
    
    const words = line.split(/\s+/);
    
    // Điều kiện 1: 2-5 từ, mỗi từ viết hoa chữ đầu
    if (words.length >= 2 && words.length <= 5) {
      // Check độ dài hợp lý
      if (line.length < 5 || line.length > 60) continue;
      
      // Check mỗi từ bắt đầu bằng chữ hoa (hỗ trợ Unicode cho tiếng Việt)
      const isValidName = words.every(word => {
        // Cho phép các từ như "van", "de", "von" (chữ thường)
        if (word.length <= 3 && /^[a-z]+$/.test(word)) return true;
        // Các từ khác phải viết hoa chữ đầu
        return /^[\p{Lu}][\p{Ll}\p{M}]*$/u.test(word);
      });
      
      if (isValidName) {
        console.log('✅ Found fullName (Strategy 1):', line);
        return line;
      }
    }
  }
  
  // Strategy 2: Tìm pattern "Name: XXX" hoặc "Họ tên: XXX"
  const namePatterns = [
    /(?:name|họ\s*tên|full\s*name|tên)[\s:：]+([^\n]{5,60})/gi,
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[0]) {
      const extracted = match[0].split(/[:：]/)[1]?.trim();
      if (extracted && extracted.length > 5 && extracted.length < 60) {
        // Validate không có số, email
        if (!/@/.test(extracted) && !/\d{3,}/.test(extracted)) {
          console.log('✅ Found fullName (Strategy 2):', extracted);
          return extracted;
        }
      }
    }
  }
  
  // Strategy 3: Dòng đầu tiên hợp lý (nếu chưa tìm thấy)
  const firstLine = lines[0]?.trim();
  if (firstLine && firstLine.length >= 5 && firstLine.length <= 60) {
    const words = firstLine.split(/\s+/);
    if (words.length >= 2 && words.length <= 5 &&
        !/@/.test(firstLine) && !/\d{3,}/.test(firstLine) &&
        !/curriculum|vitae|resume/i.test(firstLine)) {
      console.log('✅ Found fullName (Strategy 3 - First line):', firstLine);
      return firstLine;
    }
  }
  
  console.log('❌ Full name not found');
  return undefined;
}

// ✅ Extract Email
function extractEmail(text: string): string | undefined {
  const emailRegex = /[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/gi;
  const emails = text.match(emailRegex);
  if (emails && emails.length > 0) {
    console.log('✅ Found email:', emails[0].toLowerCase());
    return emails[0].toLowerCase();
  }
  console.log('❌ Email not found');
  return undefined;
}

// ✅ Extract Phone
function extractPhone(text: string): string | undefined {
  // Patterns cho số VN: +84, 84, 0
  const phonePatterns = [
    /(?:\+84|84)[\s.-]?[1-9]\d{1,2}[\s.-]?\d{3}[\s.-]?\d{3,4}/g,
    /\b0[1-9]\d{1,2}[\s.-]?\d{3}[\s.-]?\d{3,4}\b/g,
    /\b0[1-9]\d{8,9}\b/g, // Liền không dấu
  ];
  
  for (const pattern of phonePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Chuẩn hóa: xóa dấu gạch ngang, giữ dấu cách
      const phone = matches[0].replace(/[-]/g, '').replace(/\s+/g, ' ').trim();
      console.log('✅ Found phone:', phone);
      return phone;
    }
  }
  
  console.log('❌ Phone not found');
  return undefined;
}

// ✅ Extract Address
function extractAddress(text: string): string | undefined {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Pattern 1: Tên tỉnh/thành phố lớn VN
  const cityPatterns = [
    /TP\.?\s*H[ồô]\s*Ch[íi]\s*Minh/gi,
    /TP\.?\s*HCM/gi,
    /Th[àả]nh\s*ph[ốồ]\s*H[ồô]\s*Ch[íi]\s*Minh/gi,
    /H[àồ]\s*N[ộô]i/gi,
    /[ĐĐ][àả]\s*N[ẵẳ]ng/gi,
    /C[ầấ]n\s*Th[ơơ]/gi,
    /H[ảả]i\s*Ph[òó]ng/gi,
    /Nha\s*Trang/gi,
    /Bi[êế]n\s*H[òó]a/gi,
    /V[ũụ]ng\s*T[àầ]u/gi,
  ];
  
  for (const pattern of cityPatterns) {
    const match = text.match(pattern);
    if (match) {
      let addr = match[0];
      // Chuẩn hóa HCM
      if (/HCM/i.test(addr)) {
        addr = 'TP. Hồ Chí Minh';
      }
      console.log('✅ Found address:', addr);
      return addr;
    }
  }
  
  // Pattern 2: Dòng có số nhà + đường/phường/quận
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    if (/\d+/.test(line) && (
      lowerLine.includes('street') || lowerLine.includes('ward') || 
      lowerLine.includes('district') || lowerLine.includes('phường') || 
      lowerLine.includes('quận') || lowerLine.includes('đường')
    )) {
      // Đảm bảo không phải email hoặc số điện thoại
      if (!line.includes('@') && !line.includes('+84') && 
          line.length > 20 && line.length < 200) {
        console.log('✅ Found address:', line);
        return line;
      }
    }
  }
  
  // Pattern 3: "Địa chỉ:" hoặc "Address:"
  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase();
    
    if (lowerLine.includes('địa chỉ:') || lowerLine.includes('address:')) {
      const parts = lines[i].split(/[:：]/);
      if (parts.length > 1 && parts[1].trim().length > 10) {
        console.log('✅ Found address:', parts[1].trim());
        return parts[1].trim();
      }
      
      // Hoặc lấy dòng tiếp theo
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.length > 15 && nextLine.length < 200 && !nextLine.includes('@')) {
          console.log('✅ Found address:', nextLine);
          return nextLine;
        }
      }
    }
  }
  
  console.log('❌ Address not found');
  return undefined;
}

// ✅ Extract University
function extractUniversity(text: string): string | undefined {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const universityKeywords = [
    'university', 'đại học', 'học viện', 'college', 
    'trường', 'institute', 'academy', 'cao đẳng'
  ];
  
  // Method 1: Tìm trong section Education
  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase();
    
    if (lowerLine === 'education' || lowerLine.startsWith('education') ||
        lowerLine === 'học vấn' || lowerLine.startsWith('học vấn')) {
      
      // Lấy 5 dòng tiếp theo
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const nextLine = lines[j].trim();
        const nextLower = nextLine.toLowerCase();
        
        if (nextLine.length > 15 && nextLine.length < 200) {
          // Có keyword trường học
          const hasKeyword = universityKeywords.some(kw => nextLower.includes(kw));
          
          if (hasKeyword) {
            const cleaned = nextLine.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
            console.log('✅ Found university (in Education section):', cleaned);
            return cleaned;
          }
        }
      }
    }
  }
  
  // Method 2: Pattern "Đại học XXX" hoặc "XXX University"
  const universityPatterns = [
    /(?:trường\s+)?đại\s+học\s+[^\n.,;]{5,150}/gi,
    /(?:trường\s+)?university\s+[^\n.,;]{5,150}/gi,
    /[^\n.,;]{5,100}\s+university/gi,
    /(?:trường\s+)?học\s+viện\s+[^\n.,;]{5,150}/gi,
    /(?:trường\s+)?cao\s+đẳng\s+[^\n.,;]{5,150}/gi,
  ];
  
  for (const pattern of universityPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Lấy match dài nhất (thường là tên đầy đủ nhất)
      const longest = matches.reduce((a, b) => a.length > b.length ? a : b);
      const cleaned = longest.trim().replace(/\s+/g, ' ');
      
      if (cleaned.length > 15 && cleaned.length < 200) {
        console.log('✅ Found university (by pattern):', cleaned);
        return cleaned;
      }
    }
  }
  
  console.log('❌ University not found');
  return undefined;
}

// ✅ Extract Education
function extractEducation(text: string): string | undefined {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const educationKeywords = [
    /education/i,
    /học\s*vấn/i,
    /cử\s*nhân/gi, 
    /bachelor/gi, 
    /thạc\s*sĩ/gi, 
    /master/gi, 
    /tiến\s*sĩ/gi,
    /phd|ph\.d/gi,
    /gpa/gi,
    /major/gi,
    /chuyên\s*ngành/gi,
  ];
  
  let educationSection = '';
  let capturing = false;
  let capturedLines = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    
    // Bắt đầu capture khi gặp keyword
    if (!capturing && educationKeywords.some(pattern => pattern.test(line))) {
      capturing = true;
      
      // Nếu không chỉ là header
      if (line.length > 15) {
        educationSection += line + ' ';
        capturedLines++;
      }
      continue;
    }
    
    if (capturing) {
      // Dừng khi gặp section khác
      const stopKeywords = ['experience', 'skills', 'projects', 'certification', 
                           'kinh nghiệm', 'kỹ năng', 'dự án'];
      if (stopKeywords.some(kw => lowerLine === kw || lowerLine.startsWith(kw))) {
        break;
      }
      
      // Thêm dòng vào section
      if (line.length > 5 && capturedLines < 10) {
        educationSection += line + ' ';
        capturedLines++;
      }
      
      // Dừng nếu đã đủ dài
      if (educationSection.length > 400) break;
    }
  }
  
  const result = educationSection.trim().replace(/\s+/g, ' ');
  if (result.length > 20) {
    console.log('✅ Found education:', result.substring(0, 100) + '...');
    return result.length > 500 ? result.substring(0, 500) : result;
  }
  
  console.log('❌ Education not found');
  return undefined;
}

// ✅ Extract Experience
function extractExperience(text: string): string | undefined {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const experienceKeywords = [
    'experience', 'kinh nghiệm', 'work history', 'employment',
    'developer', 'engineer', 'programmer', 'lập trình viên',
    'frontend', 'backend', 'full stack', 'fullstack',
    'software', 'web', 'mobile', 'internship', 'thực tập'
  ];
  
  let experienceSection = '';
  let capturing = false;
  let capturedLines = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    
    // Bắt đầu capture
    if (!capturing && (
      lowerLine === 'experience' || 
      lowerLine.startsWith('experience') ||
      lowerLine === 'kinh nghiệm' ||
      lowerLine.startsWith('kinh nghiệm')
    )) {
      capturing = true;
      continue;
    }
    
    if (capturing) {
      // Dừng khi gặp section khác
      const stopKeywords = ['education', 'skills', 'projects', 'certification',
                           'học vấn', 'kỹ năng', 'dự án'];
      if (stopKeywords.some(kw => lowerLine === kw || lowerLine.startsWith(kw))) {
        break;
      }
      
      // Thêm dòng có năm hoặc job title
      const hasYear = /20[12]\d/.test(line);
      const hasJobTitle = experienceKeywords.some(kw => lowerLine.includes(kw));
      
      if ((hasYear || hasJobTitle || line.length > 20) && capturedLines < 15) {
        experienceSection += line + ' ';
        capturedLines++;
      }
      
      if (experienceSection.length > 600) break;
    }
  }
  
  const result = experienceSection.trim().replace(/\s+/g, ' ');
  if (result.length > 30) {
    console.log('✅ Found experience:', result.substring(0, 100) + '...');
    return result.length > 600 ? result.substring(0, 600) : result;
  }
  
  console.log('❌ Experience not found');
  return undefined;
}

// ✅ Extract Skills
function extractSkills(text: string): string[] {
  const skillDatabase = [
    // Programming Languages
    'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'c', 
    'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala', 'dart',
    
    // Frontend Frameworks
    'react', 'vue', 'angular', 'svelte', 'nextjs', 'next.js', 'nuxt', 
    'gatsby', 'ember', 'backbone',
    
    // Styling
    'html', 'css', 'sass', 'scss', 'less', 'tailwind', 'tailwindcss',
    'bootstrap', 'material-ui', 'mui', 'chakra ui',
    
    // Backend Frameworks
    'nodejs', 'node.js', 'express', 'nestjs', 'nest.js', 'fastify',
    'django', 'flask', 'fastapi', 'spring', 'spring boot', 
    'laravel', 'symfony', 'rails', 'asp.net',
    
    // Databases
    'sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 
    'elasticsearch', 'cassandra', 'dynamodb', 'oracle', 'sqlite',
    'mariadb', 'firestore',
    
    // Cloud & DevOps
    'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 
    'jenkins', 'gitlab ci', 'github actions', 'terraform', 'ansible',
    'nginx', 'apache',
    
    // Tools & Others
    'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence',
    'figma', 'sketch', 'photoshop', 'illustrator', 'xd',
    
    // Mobile
    'react native', 'flutter', 'ionic', 'xamarin', 'android', 'ios',
    
    // AI/ML
    'tensorflow', 'pytorch', 'keras', 'sklearn', 'scikit-learn',
    'pandas', 'numpy', 'opencv', 'nlp',
    
    // API & Architecture
    'rest', 'restful', 'rest api', 'graphql', 'grpc', 'websocket',
    'microservices', 'api', 'soap',
    
    // Methodologies
    'agile', 'scrum', 'kanban', 'waterfall', 'tdd', 'bdd', 'ci/cd',
    
    // State Management
    'redux', 'mobx', 'zustand', 'recoil', 'context api',
    
    // Build Tools
    'webpack', 'vite', 'rollup', 'parcel', 'babel', 'gulp', 'grunt',
    
    // Testing
    'jest', 'mocha', 'chai', 'cypress', 'selenium', 'pytest', 'junit',
    
    // Other
    'firebase', 'supabase', 'graphql', 'prisma', 'typeorm', 'sequelize',
  ];
  
  const textLower = text.toLowerCase();
  const foundSkills: string[] = [];
  
  for (const skill of skillDatabase) {
    // Word boundary check (tránh match "express" trong "expression")
    const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedSkill}\\b`, 'i');
    
    if (regex.test(textLower)) {
      foundSkills.push(skill);
    }
  }
  
  if (foundSkills.length > 0) {
    // Capitalize đúng cách
    const capitalizeMap: Record<string, string> = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'nodejs': 'Node.js',
      'node.js': 'Node.js',
      'nextjs': 'Next.js',
      'next.js': 'Next.js',
      'nestjs': 'Nest.js',
      'nest.js': 'Nest.js',
      'nuxt': 'Nuxt.js',
      'postgresql': 'PostgreSQL',
      'postgres': 'PostgreSQL',
      'mongodb': 'MongoDB',
      'mysql': 'MySQL',
      'restful': 'RESTful',
      'rest api': 'REST API',
      'graphql': 'GraphQL',
      'api': 'API',
      'html': 'HTML',
      'css': 'CSS',
      'sass': 'SASS',
      'scss': 'SCSS',
      'sql': 'SQL',
      'aws': 'AWS',
      'gcp': 'GCP',
      'azure': 'Azure',
      'fastapi': 'FastAPI',
      'vue': 'Vue.js',
      'c#': 'C#',
      'c++': 'C++',
      'spring boot': 'Spring Boot',
      'elasticsearch': 'Elasticsearch',
      'react native': 'React Native',
      'asp.net': 'ASP.NET',
      'tailwindcss': 'Tailwind CSS',
      'material-ui': 'Material-UI',
      'mui': 'MUI',
      'chakra ui': 'Chakra UI',
      'google cloud': 'Google Cloud',
      'github actions': 'GitHub Actions',
      'gitlab ci': 'GitLab CI',
      'scikit-learn': 'Scikit-learn',
      'ci/cd': 'CI/CD',
      'tdd': 'TDD',
      'bdd': 'BDD',
      'nlp': 'NLP',
      'opencv': 'OpenCV',
    };
    
    const uniqueSkills = [...new Set(foundSkills)].map(s => 
      capitalizeMap[s.toLowerCase()] || (s.charAt(0).toUpperCase() + s.slice(1))
    );
    
    console.log('✅ Found skills:', uniqueSkills);
    return uniqueSkills;
  }
  
  console.log('❌ Skills not found');
  return [];
}

// ✅ Extract Certifications
function extractCertifications(text: string): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const certifications: string[] = [];
  
  const certKeywords = [
    'certification', 'certificate', 'chứng chỉ', 'chứng nhận'
  ];
  
  let capturing = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
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
      
      if (line.length > 5 && line.length < 150 && certifications.length < 10) {
        certifications.push(line.replace(/^[-•*]\s*/, ''));
      }
    }
  }
  
  if (certifications.length > 0) {
    console.log('✅ Found certifications:', certifications);
  } else {
    console.log('❌ Certifications not found');
  }
  
  return certifications;
}

// ✅ Extract Languages
function extractLanguages(text: string): string[] {
  const languageMap: Record<string, string> = {
    'english': 'English',
    'vietnamese': 'Vietnamese',
    'tiếng anh': 'English',
    'tiếng việt': 'Vietnamese',
    'chinese': 'Chinese',
    'japanese': 'Japanese',
    'korean': 'Korean',
    'french': 'French',
    'german': 'German',
    'spanish': 'Spanish',
    'mandarin': 'Mandarin',
    'cantonese': 'Cantonese',
  };
  
  const languages: string[] = [];
  const textLower = text.toLowerCase();
  
  for (const [key, value] of Object.entries(languageMap)) {
    if (textLower.includes(key)) {
      languages.push(value);
    }
  }
  
  const uniqueLanguages = [...new Set(languages)];
  
  if (uniqueLanguages.length > 0) {
    console.log('✅ Found languages:', uniqueLanguages);
  } else {
    console.log('❌ Languages not found');
  }
  
  return uniqueLanguages;
}

// ✅ Extract Summary/Objective
function extractSummary(text: string): string | undefined {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const summaryKeywords = [
    'summary', 'objective', 'profile', 'about', 'about me',
    'tóm tắt', 'mục tiêu', 'giới thiệu', 'về tôi'
  ];
  
  let summarySection = '';
  let capturing = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase().trim();
    
    if (!capturing && summaryKeywords.some(kw => lowerLine === kw || lowerLine.startsWith(kw))) {
      capturing = true;
      
      // Nếu dòng không chỉ là header
      if (!summaryKeywords.some(kw => lowerLine === kw) && line.length > 10) {
        summarySection += line + ' ';
      }
      continue;
    }
    
    if (capturing) {
      const stopKeywords = ['experience', 'education', 'skills', 'projects', 'kinh nghiệm', 'học vấn'];
      if (stopKeywords.some(kw => lowerLine === kw || lowerLine.startsWith(kw))) {
        break;
      }
      
      summarySection += line + ' ';
      if (summarySection.length > 600) break;
    }
  }
  
  const result = summarySection.trim().replace(/\s+/g, ' ');
  if (result.length > 20) {
    console.log('✅ Found summary:', result.substring(0, 100) + '...');
    return result.length > 600 ? result.substring(0, 600) : result;
  }
  
  console.log('❌ Summary not found');
  return undefined;
}

// ✅ IMPROVED: Regex parser với tất cả fields
function extractInfoWithRegex(text: string): ParsedCV {
  console.log('\n🔍 ===== REGEX PARSING START =====');
  console.log('📄 Text length:', text.length, 'characters');
  
  const parsed: ParsedCV = {
    fullText: text,
    fullName: extractFullName(text),
    email: extractEmail(text),
    phone: extractPhone(text),
    address: extractAddress(text),
    university: extractUniversity(text),
    education: extractEducation(text),
    experience: extractExperience(text),
    skills: extractSkills(text),
    certifications: extractCertifications(text),
    languages: extractLanguages(text),
    summary: extractSummary(text),
  };
  
  console.log('\n📊 ===== REGEX PARSING RESULT =====');
  console.log('Full Name:', parsed.fullName || '❌ Not found');
  console.log('Email:', parsed.email || '❌ Not found');
  console.log('Phone:', parsed.phone || '❌ Not found');
  console.log('Address:', parsed.address || '❌ Not found');
  console.log('University:', parsed.university ? `${parsed.university.substring(0, 50)}...` : '❌ Not found');
  console.log('Skills:', parsed.skills?.length || 0, 'found');
  console.log('Certifications:', parsed.certifications?.length || 0, 'found');
  console.log('Languages:', parsed.languages?.length || 0, 'found');
  console.log('Has Education:', parsed.education ? '✅' : '❌');
  console.log('Has Experience:', parsed.experience ? '✅' : '❌');
  console.log('Has Summary:', parsed.summary ? '✅' : '❌');
  console.log('===== REGEX PARSING END =====\n');
  
  return parsed;
}

// =====================================================
// MAIN PARSE FUNCTION
// =====================================================

export async function parseCV(file: File): Promise<ParsedCV> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  try {
    // Validate file type
    const validExtensions = ['.pdf', '.docx', '.txt'];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension && !fileType) {
      throw new Error('Định dạng file không được hỗ trợ');
    }
    
    console.log('\n🚀 ===== CV PARSING START =====');
    console.log('📄 File:', fileName);
    console.log('📋 Type:', fileType);
    console.log('💾 Size:', (file.size / 1024).toFixed(2), 'KB');
    
    // ✅ STEP 1: Try AI Backend First
    try {
      console.log('\n🤖 Step 1: Trying AI Backend...');
      const aiResult = await extractInfoWithAI(file);
      
      // Validate AI result - nếu thiếu quá nhiều field, fallback về regex
      const missingFields = [
        !aiResult.fullName && 'fullName',
        !aiResult.email && 'email',
        !aiResult.phone && 'phone',
      ].filter(Boolean);
      
      if (missingFields.length <= 1) {
        // AI result tốt, chỉ thiếu tối đa 1 field quan trọng
        console.log('✅ AI parsing successful with good quality');
        console.log('===== CV PARSING END (AI) =====\n');
        return aiResult;
      } else {
        console.log('⚠️ AI result missing too many fields:', missingFields);
        console.log('🔄 Falling back to regex parsing...');
      }
      
    } catch (aiError) {
      console.log('⚠️ AI Backend failed:', aiError instanceof Error ? aiError.message : 'Unknown error');
      console.log('🔄 Falling back to regex parsing...');
    }
    
    // ✅ STEP 2: Fallback to Regex Parsing
    console.log('\n📝 Step 2: Using Regex Parsing...');
    
    // Extract text from file
    let text = '';
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      console.log('📄 Parsing PDF...');
      text = await parsePDF(file);
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      console.log('📄 Parsing DOCX...');
      text = await parseDOCX(file);
    } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      console.log('📄 Parsing TXT...');
      text = await parseTXT(file);
    }
    
    console.log('✅ Text extracted:', text.length, 'characters');
    
    // Parse with regex
    const result = extractInfoWithRegex(text);
    
    console.log('===== CV PARSING END (REGEX) =====\n');
    
    return result;
    
  } catch (error) {
    console.error('❌ Parse error:', error);
    throw error;
  }
}

// Validate file
export function validateCVFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  const allowedExtensions = ['.pdf', '.docx', '.txt'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
  
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!allowedTypes.includes(file.type) && !hasValidExtension) {
    return { valid: false, error: 'Chỉ chấp nhận file PDF, DOCX hoặc TXT' };
  }
  
  if (file.size > maxSize) {
    return { valid: false, error: 'File không được vượt quá 5MB' };
  }
  
  if (file.size === 0) {
    return { valid: false, error: 'File rỗng' };
  }
  
  return { valid: true };
}

