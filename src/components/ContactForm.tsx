'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'

interface FormData {
  name: string
  email: string
  phone: string
  travelDate: string
  travelers: string
  service: string
  message: string
}

const initialFormData: FormData = {
  name: '',
  email: '',
  phone: '',
  travelDate: '',
  travelers: '',
  service: 'car-charter',
  message: '',
}

export default function ContactForm() {
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      // 組合 LINE 訊息
      const serviceText = formData.service === 'car-charter' ? '包車服務' :
                         formData.service === 'homestay' ? '民宿住宿' : '其他諮詢'

      const message = `【網站諮詢表單】
姓名：${formData.name}
Email：${formData.email}
電話：${formData.phone || '未填寫'}
旅行日期：${formData.travelDate || '未確定'}
人數：${formData.travelers || '未確定'}
服務類型：${serviceText}
詢問內容：
${formData.message}`

      // 開啟 LINE 並帶入訊息
      const lineUrl = `https://line.me/R/oaMessage/@037nyuwk/?${encodeURIComponent(message)}`
      window.open(lineUrl, '_blank')

      setSubmitStatus('success')
      setFormData(initialFormData)
    } catch {
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 姓名 */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          姓名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="請輸入您的姓名"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          value={formData.email}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="example@email.com"
        />
      </div>

      {/* 電話 */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
          電話（選填）
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="+886 912 345 678"
        />
      </div>

      {/* 旅行日期 */}
      <div>
        <label htmlFor="travelDate" className="block text-sm font-medium text-gray-700 mb-1">
          預計旅行日期（選填）
        </label>
        <input
          type="date"
          id="travelDate"
          name="travelDate"
          value={formData.travelDate}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* 人數 */}
      <div>
        <label htmlFor="travelers" className="block text-sm font-medium text-gray-700 mb-1">
          旅行人數（選填）
        </label>
        <input
          type="text"
          id="travelers"
          name="travelers"
          value={formData.travelers}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="例：2大1小（3歲）"
        />
      </div>

      {/* 服務類型 */}
      <div>
        <label htmlFor="service" className="block text-sm font-medium text-gray-700 mb-1">
          諮詢服務 <span className="text-red-500">*</span>
        </label>
        <select
          id="service"
          name="service"
          required
          value={formData.service}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="car-charter">包車服務</option>
          <option value="homestay">民宿住宿</option>
          <option value="other">其他諮詢</option>
        </select>
      </div>

      {/* 詢問內容 */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
          詢問內容 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={4}
          value={formData.message}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          placeholder="請描述您的需求，例如：想去的景點、特殊需求等..."
        />
      </div>

      {/* 提交按鈕 */}
      <div>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? '處理中...' : '透過 LINE 送出諮詢'}
        </Button>
      </div>

      {/* 狀態訊息 */}
      {submitStatus === 'success' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg" role="alert">
          <p className="text-green-800 text-sm">
            已開啟 LINE 視窗！如果沒有自動開啟，請直接加入我們的 LINE：@037nyuwk
          </p>
        </div>
      )}

      {submitStatus === 'error' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <p className="text-red-800 text-sm">
            發生錯誤，請直接透過 LINE 聯繫我們：@037nyuwk
          </p>
        </div>
      )}

      {/* 備註 */}
      <p className="text-xs text-gray-500 text-center">
        點擊送出後將開啟 LINE 視窗，您可以預覽並修改訊息後再傳送
      </p>
    </form>
  )
}
