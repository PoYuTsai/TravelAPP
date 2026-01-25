'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { trackFormSubmit, trackLineClick } from '@/lib/analytics'
import { trackGoogleAdsFormSubmit } from '@/components/GoogleAdsConversion'

interface FormData {
  name: string
  email: string
  phone: string
  travelDate: string
  travelers: string
  service: string
  message: string
}

interface FormErrors {
  name?: string
  email?: string
  message?: string
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

// Email 驗證正則表達式 (改進版：檢查 TLD 長度和更多格式)
const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

// LINE URL 最大長度限制 (LINE 建議不超過 2000 字元)
const LINE_URL_MAX_LENGTH = 2000

// 表單欄位最大長度
const MAX_LENGTHS = {
  name: 100,
  email: 254, // RFC 5321 標準
  phone: 30,
  travelers: 50,
  message: 1000,
}

export default function ContactForm() {
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // 驗證單一欄位
  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case 'name':
        if (!value.trim()) return '請輸入姓名'
        if (value.trim().length < 2) return '姓名至少需要 2 個字'
        if (value.length > MAX_LENGTHS.name) return `姓名不可超過 ${MAX_LENGTHS.name} 個字`
        return undefined
      case 'email':
        if (!value.trim()) return '請輸入 Email'
        if (value.length > MAX_LENGTHS.email) return 'Email 格式無效'
        if (!emailRegex.test(value)) return '請輸入有效的 Email 格式'
        return undefined
      case 'phone':
        // 電話為選填，有值時才驗證
        if (value && value.length > MAX_LENGTHS.phone) return `電話不可超過 ${MAX_LENGTHS.phone} 個字`
        return undefined
      case 'message':
        if (!value.trim()) return '請輸入詢問內容'
        if (value.trim().length < 10) return '詢問內容至少需要 10 個字'
        if (value.length > MAX_LENGTHS.message) return `詢問內容不可超過 ${MAX_LENGTHS.message} 個字`
        return undefined
      default:
        return undefined
    }
  }

  // 驗證所有欄位
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      name: validateField('name', formData.name),
      email: validateField('email', formData.email),
      message: validateField('message', formData.message),
    }
    setErrors(newErrors)
    return !Object.values(newErrors).some(Boolean)
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // 如果已經 touched 過，即時驗證
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 標記所有必填欄位為 touched
    setTouched({ name: true, email: true, message: true })

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      // 組合 LINE 訊息
      const serviceText = formData.service === 'car-charter' ? '包車服務' :
                         formData.service === 'homestay' ? '民宿住宿' : '其他諮詢'

      let message = `【網站諮詢表單】
姓名：${formData.name}
Email：${formData.email}
電話：${formData.phone || '未填寫'}
旅行日期：${formData.travelDate || '未確定'}
人數：${formData.travelers || '未確定'}
服務類型：${serviceText}
詢問內容：
${formData.message}`

      // 計算 LINE URL 長度並截斷訊息（如需要）
      const baseUrl = 'https://line.me/R/oaMessage/@037nyuwk/?'
      const encodedMessage = encodeURIComponent(message)
      const fullUrl = baseUrl + encodedMessage

      if (fullUrl.length > LINE_URL_MAX_LENGTH) {
        // 估算可用字元數並截斷訊息
        const availableLength = LINE_URL_MAX_LENGTH - baseUrl.length - 100 // 保留緩衝
        const truncatedMessage = message.slice(0, Math.floor(availableLength / 3)) + '\n...(訊息過長已截斷，請在 LINE 中補充)'
        message = truncatedMessage
      }

      // 開啟 LINE 並帶入訊息
      const lineUrl = `${baseUrl}${encodeURIComponent(message)}`
      window.open(lineUrl, '_blank')

      // 追蹤表單提交和 LINE 點擊 (GA4 + Google Ads)
      trackFormSubmit('contact_inquiry')
      trackLineClick('Contact Form Submit')
      trackGoogleAdsFormSubmit()

      setSubmitStatus('success')
      setFormData(initialFormData)
      setTouched({})
      setErrors({})
    } catch {
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 輸入框樣式（根據錯誤狀態）
  const getInputClassName = (fieldName: keyof FormErrors) => {
    const baseClass = 'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors'
    const hasError = touched[fieldName] && errors[fieldName]
    return `${baseClass} ${hasError ? 'border-red-500 bg-red-50' : 'border-gray-300'}`
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
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
          maxLength={MAX_LENGTHS.name}
          value={formData.name}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={touched.name && !!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className={getInputClassName('name')}
          placeholder="請輸入您的姓名"
        />
        {touched.name && errors.name && (
          <p id="name-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.name}
          </p>
        )}
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
          maxLength={MAX_LENGTHS.email}
          value={formData.email}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={touched.email && !!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className={getInputClassName('email')}
          placeholder="example@email.com"
        />
        {touched.email && errors.email && (
          <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.email}
          </p>
        )}
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
          maxLength={MAX_LENGTHS.phone}
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
          maxLength={MAX_LENGTHS.travelers}
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
          maxLength={MAX_LENGTHS.message}
          value={formData.message}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={touched.message && !!errors.message}
          aria-describedby={errors.message ? 'message-error' : undefined}
          className={`${getInputClassName('message')} resize-none`}
          placeholder="請描述您的需求，例如：想去的景點、特殊需求等..."
        />
        {touched.message && errors.message && (
          <p id="message-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.message}
          </p>
        )}
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
