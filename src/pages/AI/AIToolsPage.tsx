// src/pages/ai/AIToolsPage.tsx
import React, { useState } from "react";
import { 
  MessageCircle,
  Key,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Sparkles
} from "lucide-react";

interface APIKeys {
  openrouter?: string;
}

export default function AIToolsPage() {
  const [apiKeys, setApiKeys] = useState<APIKeys>(() => {
    const savedKey = localStorage.getItem("openrouter_api_key");
    return savedKey ? { openrouter: savedKey } : {};
  });
  const [tempKeys, setTempKeys] = useState<APIKeys>(apiKeys);
  const [showKeys, setShowKeys] = useState({ openrouter: false });
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const hasApiKey = !!apiKeys.openrouter;

  const handleSaveApiKey = () => {
    setSaveStatus("saving");
    setTimeout(() => {
      const newKeys: APIKeys = {};
      
      if (tempKeys.openrouter?.trim()) {
        newKeys.openrouter = tempKeys.openrouter.trim();
        localStorage.setItem("openrouter_api_key", tempKeys.openrouter.trim());
      } else {
        localStorage.removeItem("openrouter_api_key");
      }
      
      setApiKeys(newKeys);
      setSaveStatus("saved");
      
      setTimeout(() => {
        setShowApiKeyModal(false);
        setSaveStatus("idle");
      }, 1500);
    }, 500);
  };

  const handleRemoveApiKey = () => {
    setApiKeys({});
    setTempKeys({});
    localStorage.removeItem("openrouter_api_key");
    setShowApiKeyModal(false);
  };

  const getMaskedKey = (key: string) => {
    if (!key) return "";
    if (key.length <= 8) return "••••••••";
    return `${key.slice(0, 4)}${"•".repeat(key.length - 8)}${key.slice(-4)}`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">AI Virtual Assistant</h1>
        <button
          onClick={() => setShowApiKeyModal(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition ${
            hasApiKey 
              ? "bg-green-100 text-green-700 hover:bg-green-200" 
              : "bg-amber-100 text-amber-700 hover:bg-amber-200"
          }`}
        >
          <Key className="w-4 h-4" />
          <span className="text-sm font-medium">
            {hasApiKey ? "API Key đã cấu hình" : "Cần cấu hình API Key"}
          </span>
        </button>
      </div>

      {!hasApiKey && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-amber-800 font-medium">Chưa cấu hình API Key</p>
            <p className="text-xs text-amber-700 mt-1">
              Vui lòng nhập OpenRouter API Key để sử dụng AI Assistant. 
              <button 
                onClick={() => setShowApiKeyModal(true)}
                className="ml-1 underline font-medium"
              >
                Cấu hình ngay
              </button>
            </p>
          </div>
        </div>
      )}

      {hasApiKey && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-blue-800">
              API đang hoạt động:
            </span>
            <span className="px-2 py-0.5 bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 rounded text-xs font-medium">
              OpenRouter AI (GPT-4o-mini)
            </span>
          </div>
        </div>
      )}

      <div className="mt-4">
        {hasApiKey ? (
          <ChatbotUI apiKeys={apiKeys} />
        ) : (
          <div className="text-center py-12 text-gray-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Vui lòng cấu hình API Key để sử dụng AI Assistant</p>
          </div>
        )}
      </div>

      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Key className="w-5 h-5" />
              Cấu hình OpenRouter API Key
            </h2>

            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <label className="block text-sm font-medium text-gray-700">
                    OpenRouter API Key
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showKeys.openrouter ? "text" : "password"}
                    value={tempKeys.openrouter || ""}
                    onChange={(e) => setTempKeys(prev => ({ ...prev, openrouter: e.target.value }))}
                    placeholder="sk-or-v1-..."
                    className="w-full border rounded-md px-3 py-2 pr-10 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <button
                    onClick={() => setShowKeys(prev => ({ ...prev, openrouter: !prev.openrouter }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showKeys.openrouter ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Lấy từ{" "}
                  <a 
                    href="https://openrouter.ai/keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-purple-600 underline"
                  >
                    OpenRouter Dashboard
                  </a>
                </p>
                {apiKeys.openrouter && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                    ✓ Key hiện tại: {getMaskedKey(apiKeys.openrouter)}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveApiKey}
                  disabled={saveStatus === "saving"}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition ${
                    saveStatus === "saved"
                      ? "bg-green-600 text-white"
                      : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                  }`}
                >
                  {saveStatus === "saving" ? (
                    "Đang lưu..."
                  ) : saveStatus === "saved" ? (
                    <span className="flex items-center justify-center gap-1">
                      <Check className="w-4 h-4" />
                      Đã lưu
                    </span>
                  ) : (
                    "Lưu API Key"
                  )}
                </button>
                
                {apiKeys.openrouter && (
                  <button
                    onClick={handleRemoveApiKey}
                    className="px-4 py-2 rounded-md bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    Xóa
                  </button>
                )}
                
                <button
                  onClick={() => {
                    setShowApiKeyModal(false);
                    setTempKeys(apiKeys);
                    setSaveStatus("idle");
                  }}
                  className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Hủy
                </button>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <p className="text-xs text-blue-800">
                <strong>💡 Lưu ý:</strong> OpenRouter hỗ trợ nhiều AI models (GPT-4, Claude, Gemini...). 
                API key sẽ được lưu cục bộ trên trình duyệt của bạn.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TabUIProps {
  apiKeys: APIKeys;
}

function ChatbotUI({ apiKeys }: TabUIProps) {
  const [messages, setMessages] = useState<{role: string; content: string}[]>([
    { role: "bot", content: "Xin chào Admin! Tôi có thể giúp bạn:\n• Tóm tắt CV tốt nhất\n• Liệt kê CV tiềm năng\n• Gửi email template\n• Phân tích dữ liệu tuyển dụng\n\nHãy cho tôi biết bạn cần gì!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput("");
    setLoading(true);
    setError("");

    try {
      const prompt = `Bạn là AI Assistant hỗ trợ Admin quản lý tuyển dụng.

Lịch sử:
${messages.map(m => `${m.role === 'user' ? 'Admin' : 'AI'}: ${m.content}`).join('\n')}

Admin: ${currentInput}

Trả lời chuyên nghiệp, hữu ích bằng tiếng Việt:`;

      const botResponse = await callOpenRouterAPI(prompt, apiKeys.openrouter!);
      const botMsg = { role: "bot", content: botResponse };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error('OpenRouter API error:', err);
      setError(err.message || 'Có lỗi xảy ra');
      
      const errorMsg = { 
        role: "bot", 
        content: `⚠️ Lỗi OpenRouter: ${err.message}. Vui lòng kiểm tra API key.` 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-medium">AI Admin Assistant</h2>
        <span className="text-xs px-2 py-1 rounded bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700">
          OpenRouter AI
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        AI Assistant hỗ trợ quản lý CV, phân tích ứng viên và gửi email tự động.
      </p>

      <div className="border rounded p-3 bg-white">
        <div className="h-96 overflow-auto p-3 bg-gray-50 rounded mb-3">
          {messages.map((msg, i) => (
            <div key={i} className={`mb-3 ${msg.role === "user" ? "text-right" : ""}`}>
              <span className={`inline-block px-3 py-2 rounded-lg text-sm max-w-[85%] whitespace-pre-wrap ${
                msg.role === "user" 
                  ? "bg-blue-600 text-white" 
                  : msg.content.startsWith("⚠️")
                    ? "bg-red-100 text-red-800 border border-red-200"
                    : "bg-white text-gray-800 border border-gray-200"
              }`}>
                {msg.content}
              </span>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="animate-pulse">●</div>
              <div className="animate-pulse">●</div>
              <div className="animate-pulse">●</div>
              <span className="text-xs">(OpenRouter)</span>
            </div>
          )}
        </div>
        {error && (
          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}
        
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            onClick={() => setInput("Tóm tắt 5 CV tốt nhất")}
            className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
          >
            📄 Tóm tắt CV tốt
          </button>
          <button
            onClick={() => setInput("Liệt kê CV tiềm năng")}
            className="text-xs px-3 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100"
          >
            🎯 CV tiềm năng
          </button>
          <button
            onClick={() => setInput("Gửi email template")}
            className="text-xs px-3 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
          >
            ✉️ Email template
          </button>
          <button
            onClick={() => setInput("Thống kê tuyển dụng")}
            className="text-xs px-3 py-1 bg-orange-50 text-orange-700 rounded hover:bg-orange-100"
          >
            📊 Thống kê
          </button>
        </div>

        <div className="flex gap-2">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !loading && handleSend()}
            className="flex-1 border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            placeholder="Hỏi AI về CV, ứng viên, hoặc yêu cầu gửi email..." 
            disabled={loading}
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {loading ? "Đang xử lý..." : "Gửi"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function callOpenRouterAPI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'CV Recruitment System'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Bạn là AI Assistant chuyên nghiệp hỗ trợ tuyển dụng. Trả lời chính xác, ngắn gọn bằng tiếng Việt.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  throw new Error('Invalid OpenRouter response format');
}