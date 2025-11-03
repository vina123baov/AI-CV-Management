// src/components/settings/EmailSettings.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { KeyRound } from "lucide-react"

export function EmailSettings() {
  const [apiKey, setApiKey] = useState("")
  const [sendingEmail, setSendingEmail] = useState("noreply@company.com")
  const [senderName, setSenderName] = useState("Recruit AI")

  const handleSave = () => {
    // Logic lưu cài đặt sẽ được thêm vào sau
    console.log("Saving email settings:", { apiKey, sendingEmail, senderName })
    alert("Cài đặt đã được lưu (giả lập).")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Cài đặt Email
        </CardTitle>
        <CardDescription>Cấu hình dịch vụ gửi email của bạn (ví dụ: Resend).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="resend-api-key">Resend API Key</Label>
          <Input
            id="resend-api-key"
            type="password"
            placeholder="re_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Lấy API key từ Resend Dashboard
            </a>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
            <Label htmlFor="sending-email">Email gửi</Label>
            <Input
                id="sending-email"
                type="email"
                value={sendingEmail}
                onChange={(e) => setSendingEmail(e.target.value)}
            />
            </div>

            <div className="space-y-2">
            <Label htmlFor="sender-name">Tên người gửi</Label>
            <Input
                id="sender-name"
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
            />
            </div>
        </div>
      </CardContent>
    </Card>
  )
}