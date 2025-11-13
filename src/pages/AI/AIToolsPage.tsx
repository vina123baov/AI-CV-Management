// src/pages/ai/AIToolsPage.tsx
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  MessageCircle,
  Key,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Sparkles,
  Bot,
  Database,
  Send,
} from "lucide-react";

interface APIKeys {
  openrouter?: string;
}

// --- PHẦN QUẢN LÝ API KEY (KHÔNG THAY ĐỔI) ---
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
			  Vui lòng nhập OpenRouter API Key để sử dụng AI Assistant.{" "}
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
			<span className="font-medium text-blue-800">API đang hoạt động:</span>
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

			{/* Đã xóa ký tự '_' bị lạc ở dòng trước */}
			<div className="space-y-6">
			  <div>
				<div className="flex items-center gap-2 mb-2">
				  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
					<Sparkles className="w-4 h-4 text-white" />
				  </div>
				  <label className="block text-sm font-medium text-gray-700">OpenRouter API Key</label>
				</div>
				<div className="relative">
				  <input
					type={showKeys.openrouter ? "text" : "password"}
					value={tempKeys.openrouter || ""}
					onChange={(e) => setTempKeys((prev) => ({ ...prev, openrouter: e.target.value }))}
					placeholder="sk-or-v1-..."
					className="w-full border rounded-md px-3 py-2 pr-10 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
				  />
				  <button
					onClick={() => setShowKeys((prev) => ({ ...prev, openrouter: !prev.openrouter }))}
					className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
				  >
					{showKeys.openrouter ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
				  </button>
				</div>
				<p className="text-xs text-gray-500 mt-1">
				  Lấy từ{" "}
				  <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-purple-600 underline">
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
				  <button onClick={handleRemoveApiKey} className="px-4 py-2 rounded-md bg-red-100 text-red-700 hover:bg-red-200">
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
				<strong>💡 Lưu ý:</strong> OpenRouter hỗ trợ nhiều AI models (GPT-4, Claude, Gemini...). API key sẽ được lưu cục bộ trên trình duyệt của bạn.
			  </p>
			</div>
		  </div>
		</div>
	  )}
	</div>
  );
}

// --- BẮT ĐẦU PHẦN NÂNG CẤP (ĐÃ SỬA LỖI) ---

// --- ĐỊNH NGHĨA CÁC TYPES CHO TIN NHẮN ---
type MessageRole = "user" | "assistant" | "system" | "tool";

interface ToolCall {
  id: string;
  type: "function";
  function: {
	name: string;
	arguments: string; // JSON string
  };
}

interface OpenAIMessage {
  role: MessageRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// --- ĐỊNH NGHĨA CÁC CÔNG CỤ (TOOLS) MÀ AI CÓ THỂ SỬ DỤNG ---
const tools = [
  {
	type: "function",
	function: {
	  name: "get_candidates_from_db",
	  description:
		"Lấy danh sách ứng viên (CV) từ database. Có thể lọc theo vị trí ứng tuyển, từ khóa, và giới hạn số lượng.",
	  parameters: {
		type: "object",
		properties: {
		  job_title: {
			type: "string",
			description: "Vị trí ứng tuyển để lọc, ví dụ: 'React Developer', 'Data Analyst'",
		  },
		  keywords: {
			type: "string",
			description: "Các từ khóa để tìm kiếm trong CV, ví dụ: 'Python, SQL', 'NextJS'",
		  },
		  limit: {
			type: "number",
			description: "Số lượng CV tối đa cần lấy. Mặc định là 10.",
		  },
		  order_by_recent: {
			type: "boolean",
			description: "Sắp xếp theo CV mới nhất (true) hay cũ nhất (false). Mặc định là true.",
		  },
		},
		required: [],
	  },
	},
  },
];

// *** SỬA LỖI (ts-2345): Thêm Type cho args ***
type ToolCallArgs = {
  job_title?: string;
  keywords?: string;
  limit?: number;
  order_by_recent?: boolean;
};

interface TabUIProps {
  apiKeys: APIKeys;
}

// --- COMPONENT CHATBOTUI ĐÃ NÂNG CẤP ---
function ChatbotUI({ apiKeys }: TabUIProps) {
  const [messages, setMessages] = useState<OpenAIMessage[]>([
	{
	  role: "system",
	  content:
		"Bạn là AI Assistant chuyên nghiệp hỗ trợ Admin quản lý tuyển dụng. Trả lời chính xác, ngắn gọn bằng tiếng Việt. Khi được yêu cầu lấy dữ liệu CV, hãy sử dụng tool `get_candidates_from_db`.",
	},
	{
	  role: "assistant",
	  content:
		"Xin chào Admin! Tôi có thể giúp bạn:\n• Tóm tắt CV tốt nhất\n• Liệt kê CV tiềm năng (từ database)\n• Gửi email template\n• Phân tích dữ liệu tuyển dụng\n\nHãy cho tôi biết bạn cần gì!",
	},
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
	messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // HÀM THỰC THI TOOL (TRUY VẤN SUPABASE)
  const executeToolCall = async (toolCall: ToolCall) => {
	const { name, arguments: argsString } = toolCall.function;
	// *** SỬA LỖI (ts-2345): Gán type cho args ***
	const args: ToolCallArgs = JSON.parse(argsString);

	if (name === "get_candidates_from_db") {
	  try {
		// !!! QUAN TRỌNG: Thay 'candidates' bằng tên bảng của bạn
		// !!! QUAN TRỌNG: Thay 'full_name', 'job_title', 'cv_summary', 'created_at'
		//                 bằng tên cột thực tế trong DB của bạn.
		let query = supabase
		  .from("candidates") // <-- !!! THAY TÊN BẢNG
		  .select("id, full_name, email, job_title, created_at, cv_summary") // <-- !!! THAY TÊN CỘT
		  .limit(args.limit || 10)
		  .order("created_at", { ascending: args.order_by_recent === false });

		if (args.job_title) {
		  query = query.ilike("job_title", `%${args.job_title}%`);
		}
		// *** SỬA LỖI (ts-2345): Type guard 'if (args.keywords)' 
		//                     giờ đã hoạt động đúng vì 'args' đã có type ***
		if (args.keywords) {
		  query = query.ilike("cv_summary", `%${args.keywords}%`); // <-- !!! THAY TÊN CỘT
		}

		const { data, error } = await query;

		if (error) throw error;
		return JSON.stringify(data);
	  } catch (dbError: any) {
		console.error("Supabase query error:", dbError);
		return JSON.stringify({ error: "Lỗi truy vấn database", details: dbError.message });
	  }
	}
	return JSON.stringify({ error: `Tool '${name}' không được hỗ trợ.` });
  };

  // HÀM GỬI TIN NHẮN ĐÃ NÂNG CẤP (AGENT LOOP)
  const handleSend = async () => {
	if (!input.trim() || !apiKeys.openrouter) return;

	const userMsg: OpenAIMessage = { role: "user", content: input };
	const newMessages: OpenAIMessage[] = [...messages, userMsg];

	setMessages(newMessages);
	setInput("");
	setLoading(true);
	setError("");

	try {
	  // 1. Gửi tin nhắn và tools đến AI
	  const botResponseMsg = await callOpenRouterAPI(newMessages, apiKeys.openrouter, tools);

	  // 2. Kiểm tra xem AI muốn gọi tool hay trả lời
	  if (botResponseMsg.tool_calls && botResponseMsg.tool_calls.length > 0) {
		// AI muốn gọi tool (truy vấn DB)
		const thinkingMsg: OpenAIMessage = {
		  role: "assistant",
		  content: null,
		  tool_calls: botResponseMsg.tool_calls,
		};
		setMessages((prev) => [...prev, thinkingMsg]);

		const messagesWithToolHistory = [...newMessages, thinkingMsg];

		for (const toolCall of botResponseMsg.tool_calls) {
		  setMessages((prev) => [
			...prev,
			{
			  role: "assistant",
			  content: `🔍 Đang thực thi: ${toolCall.function.name}...\n(Truy vấn Supabase Database...)`,
			  tool_call_id: toolCall.id,
			},
		  ]);

		  const toolResult = await executeToolCall(toolCall);

		  const toolResultMsg: OpenAIMessage = {
			role: "tool",
			tool_call_id: toolCall.id,
			content: toolResult,
		  };
		  messagesWithToolHistory.push(toolResultMsg);
		}

		// 3. GỌI API LẦN 2: Gửi kết quả tool lại cho AI
		const finalBotResponse = await callOpenRouterAPI(messagesWithToolHistory, apiKeys.openrouter, tools);

		setMessages((prev) => [...prev, finalBotResponse]);
	  } else {
		// AI trả lời trực tiếp (không cần tool)
		setMessages((prev) => [...prev, botResponseMsg]);
	  }
	} catch (err: any) {
	  console.error("OpenRouter API error:", err);
	  const errorMsg: OpenAIMessage = {
		role: "assistant",
		content: `⚠️ Lỗi OpenRouter: ${err.message}. Vui lòng kiểm tra API key.`,
	  };
	  setMessages((prev) => [...prev, errorMsg]);
	  setError(err.message || "Có lỗi xảy ra");
	} finally {
	  setLoading(false);
	}
  };

  // Hàm render tin nhắn
  const renderMessageContent = (msg: OpenAIMessage) => {
	if (msg.role === "tool") {
	  return (
		<span className="text-xs italic text-gray-500">[Đã trả về kết quả từ tool: {msg.tool_call_id}]</span>
	  );
	}
	if (msg.role === "assistant" && !msg.content && msg.tool_calls) {
	  return (
		<span className="text-sm italic text-gray-600">
		  <Bot className="w-4 h-4 inline-block mr-1 animate-spin" />
		  AI đang quyết định gọi tool: {msg.tool_calls[0].function.name}...
		</span>
	  );
	}
	return msg.content;
  };

  // --- GIAO DIỆN CHATBOT (RENDER) ---
  return (
	<div>
	  <div className="flex justify-between items-center mb-2">
		<h2 className="text-lg font-medium">AI Admin Assistant</h2>
		<span className="text-xs px-2 py-1 rounded bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700">
		  <Database className="w-3 h-3 inline-block mr-1" />
		  Kết nối Supabase
		</span>
	  </div>
	  <p className="text-sm text-gray-600 mb-4">
		AI Assistant (đã kết nối data) hỗ trợ quản lý CV, phân tích ứng viên.
	  </p>

	  <div className="border rounded p-3 bg-white">
		<div className="h-96 overflow-auto p-3 bg-gray-50 rounded mb-3">
		  {messages.map(
			(msg, i) =>
			  msg.role !== "system" &&
			  msg.role !== "tool" && (
				<div key={i} className={`mb-3 ${msg.role === "user" ? "text-right" : ""}`}>
				  <span
					className={`inline-block px-3 py-2 rounded-lg text-sm max-w-[85%] whitespace-pre-wrap ${
					  msg.role === "user"
						? "bg-blue-600 text-white"
						: msg.content?.startsWith("⚠️")
						? "bg-red-100 text-red-800 border border-red-200"
						: msg.content?.includes("Đang thực thi") || !msg.content
						? "bg-amber-50 text-amber-800 border border-amber-200"
						: "bg-white text-gray-800 border border-gray-200"
					}`}
				  >
					{renderMessageContent(msg)}
				  </span>
				</div>
			  )
		  )}
		  {loading && (
			<div className="flex items-center gap-2 text-gray-500 text-sm">
			  <div className="animate-pulse">●</div>
			  <div className="animate-pulse">●</div>
			  <div className="animate-pulse">●</div>
			  <span className="text-xs">(AI đang xử lý...)</span>
			</div>
		  )}
		  <div ref={messagesEndRef} />
		</div>
		{error && (
		  <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
		)}

		<div className="mb-3 flex flex-wrap gap-2">
		  <button
			onClick={() => setInput("Tóm tắt 5 CV tốt nhất ứng tuyển React Developer")}
			className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
		  >
			📄 Tóm tắt 5 CV React
		  </button>
		  <button
			onClick={() => setInput("Liệt kê 3 CV mới nhất")}
			className="text-xs px-3 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100"
		  >
			🎯 3 CV mới nhất
		  </button>
		  <button
			onClick={() => setInput("Gửi email template cho ứng viên ID 123")}
			className="text-xs px-3 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
		  >
			✉️ Email template
		  </button>
		</div>

		<div className="flex gap-2">
		  <input
			value={input}
			onChange={(e) => setInput(e.target.value)}
			onKeyPress={(e) => e.key === "Enter" && !loading && handleSend()}
			className="flex-1 border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			placeholder="Hỏi AI: 'Lấy 5 CV React mới nhất', 'Tìm CV có kỹ năng Python'..."
			disabled={loading}
		  />
		  <button
			onClick={handleSend}
			disabled={loading || !input.trim()}
			className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
		  >
			{loading ? "..." : <Send className="w-4 h-4" />}
		  </button>
		</div>
	  </div>
	</div>
  );
}

// --- HÀM GỌI API ĐÃ NÂNG CẤP ---
async function callOpenRouterAPI(messages: OpenAIMessage[], apiKey: string, tools: any[]): Promise<OpenAIMessage> {
  // Lọc bỏ các tin nhắn rỗng (nếu có)
  const filteredMessages = messages.filter(
	(msg) =>
	  msg.role === "system" ||
	  msg.role === "user" ||
	  (msg.role === "assistant" && (msg.content || msg.tool_calls)) ||
	  (msg.role === "tool" && msg.tool_call_id)
  );

  const body = {
	model: "openai/gpt-4o-mini",
	messages: filteredMessages,
	tools: tools,
	tool_choice: "auto",
	temperature: 0.5,
	max_tokens: 2000,
  };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
	method: "POST",
	headers: {
	  "Content-Type": "application/json",
	  Authorization: `Bearer ${apiKey}`,
	  "HTTP-Referer": window.location.origin,
	  "X-Title": "CV Recruitment System",
	},
	body: JSON.stringify(body),
  });

  if (!response.ok) {
	const errorData = await response.json().catch(() => ({}));
	throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.choices?.[0]?.message) {
	return data.choices[0].message;
  }

  throw new Error("Invalid OpenRouter response format");
}