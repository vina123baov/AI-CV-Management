// src/services/cvParserService.ts
import type { ParsedCV } from '@/utils/advancedCVParser';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface CVParserResponse {
  success: boolean;
  data: {
    name: string;
    email: string;
    phone: string;
    address: string;
    skills: string[];
    experience: string;
    education: string;
    university: string;
    fullText: string;
    parseQuality: "excellent" | "good" | "fair" | "poor";
    extractedFields: Record<string, any>;
  };
  metadata?: {
    tokens_count: number;
    confidence: number;
    model: string;
  };
}

export class CVParserService {
  static async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error('Health check failed with status:', response.status);
        return false;
      }
      
      const data = await response.json();
      return data.status === 'healthy' && data.model_loaded;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  static async parseCV(file: File): Promise<ParsedCV> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/parse-cv`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to parse CV';
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result: CVParserResponse = await response.json();

      if (!result.success) {
        throw new Error('CV parsing failed');
      }

      // Convert API response to ParsedCV format
      const parsedCV: ParsedCV = {
        name: result.data.name,
        email: result.data.email,
        phone: result.data.phone,
        address: result.data.address,
        skills: Array.isArray(result.data.skills) ? result.data.skills : [],
        experience: result.data.experience,
        education: result.data.education,
        university: result.data.university,
        fullText: result.data.fullText,
        parseQuality: result.data.parseQuality,
        extractedFields: Object.keys(result.data.extractedFields || {})
      };

      return parsedCV;
    } catch (error) {
      console.error('Error parsing CV:', error);
      throw error;
    }
  }

  static async batchParseCV(files: File[]): Promise<Array<{
    filename: string;
    success: boolean;
    data?: ParsedCV;
    error?: string;
  }>> {
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(`${API_BASE_URL}/api/batch-parse-cv`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to parse CVs');
      }

      const result = await response.json();

      return result.results.map((r: any) => ({
        filename: r.filename,
        success: r.success,
        data: r.success ? {
          name: r.data.name,
          email: r.data.email,
          phone: r.data.phone,
          address: r.data.address,
          skills: Array.isArray(r.data.skills) ? r.data.skills : [],
          experience: r.data.experience,
          education: r.data.education,
          university: r.data.university,
          fullText: r.data.fullText,
          parseQuality: r.data.parseQuality,
          extractedFields: Object.keys(r.data.extractedFields || {})
        } : undefined,
        error: r.error
      }));
    } catch (error) {
      console.error('Error batch parsing CVs:', error);
      throw error;
    }
  }
}