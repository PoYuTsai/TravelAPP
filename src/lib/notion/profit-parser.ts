// src/lib/notion/profit-parser.ts

export interface ParseResult {
  value: number
  confident: boolean
}

/**
 * 解析利潤/收入文字，提取最終數字
 *
 * 優先順序：
 * 1. 獨立一行的數字（最後一個）
 * 2. 最後一個 = 數字
 * 3. 嘗試計算開頭的簡單算式
 * 4. 都找不到 → 0
 */
export function parseNumberText(text: string): ParseResult {
  if (!text || text.trim() === '') {
    return { value: 0, confident: false }
  }

  const cleanText = text.trim()
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean)

  // 策略 1: 找獨立一行的數字（最後一個）
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    const standaloneMatch = line.match(/^([\d,]+)$/)
    if (standaloneMatch) {
      const num = parseFloat(standaloneMatch[1].replace(/,/g, ''))
      if (!isNaN(num) && num > 0) {
        return { value: num, confident: true }
      }
    }
  }

  // 策略 2: 找最後一個 "= 數字" 模式
  const allText = cleanText.replace(/\n/g, ' ')
  const equalPatterns = allText.match(/=\s*([\d,]+)/g)
  if (equalPatterns && equalPatterns.length > 0) {
    const lastEqual = equalPatterns[equalPatterns.length - 1]
    const num = parseFloat(lastEqual.replace(/[=\s,]/g, ''))
    if (!isNaN(num) && num > 0) {
      return { value: num, confident: true }
    }
  }

  // 策略 3: 嘗試計算開頭的簡單算式 (如 3000+2500)
  const firstLine = lines[0] || ''
  const simpleCalcMatch = firstLine.match(/^([\d,]+)\s*([+\-])\s*([\d,]+)/)
  if (simpleCalcMatch) {
    const a = parseFloat(simpleCalcMatch[1].replace(/,/g, ''))
    const b = parseFloat(simpleCalcMatch[3].replace(/,/g, ''))
    const op = simpleCalcMatch[2]
    const result = op === '+' ? a + b : a - b
    if (!isNaN(result)) {
      return { value: result, confident: false }
    }
  }

  // 策略 4: 找第一個數字
  const firstNumber = allText.match(/([\d,]+)/)
  if (firstNumber) {
    const num = parseFloat(firstNumber[1].replace(/,/g, ''))
    if (!isNaN(num) && num > 0) {
      return { value: num, confident: false }
    }
  }

  return { value: 0, confident: false }
}
