/**
 * 试卷自动切题工具
 * 通过OCR识别题号位置，自动将试卷切分成多道题目
 * 
 * 优化策略V2：
 * 1. 宽松题号匹配 - 支持多种格式：1. 1、(1) 等
 * 2. 智能过滤 - 排除注意事项、页码等干扰
 * 3. 位置分析 - 利用Y坐标间距辅助判断
 * 4. 行合并 - 处理跨行题目
 */
import Tesseract from 'tesseract.js'

/**
 * 题目边界信息
 */
export interface QuestionBound {
  index: number          // 题目序号
  y0: number             // 起始Y坐标
  y1: number             // 结束Y坐标
  text: string           // 题号文本
  fullText?: string      // 该题目的完整文本
  questionType?: string  // 题目类型（选择/填空/解答）
}

/**
 * 切分结果
 */
export interface SplitResult {
  questions: {
    index: number
    base64: string       // 裁剪后的图片base64
    ocrText: string      // OCR识别的文本
  }[]
  originalWidth: number
  originalHeight: number
}

/**
 * 题号匹配模式 - 更宽松
 * 支持: 1. 2. 3. / 1、2、3、/ 一、二、三、/ (1) (2) / ① ② 等
 */
const QUESTION_PATTERNS = [
  /^\s*(\d{1,2})\s*[\.、．。·:：]/,              // 1. 2. 1、2、1：
  /^\s*(\d{1,2})\s*[,，]?\s*[若设已如当则]/,    // 1.若 1,设 等直接跟题目内容
  /^\s*[（\(]\s*(\d{1,2})\s*[）\)]/,            // (1) (2) （1）（2）
  /^\s*([一二三四五六七八九十]+)\s*[、\.．。]/,  // 一、二、三、
  /^\s*第\s*([一二三四五六七八九十\d]+)\s*题/,  // 第一题 第1题
  /^\s*[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]/,             // ① ② ③
  /^\s*(\d{1,2})\s+[^\d\s]/,                    // 1 后面跟内容（空格分隔）
]

/**
 * 圆圈数字映射
 */
const CIRCLE_NUM_MAP: Record<string, number> = {
  '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5,
  '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9, '⑩': 10,
  '⑪': 11, '⑫': 12, '⑬': 13, '⑭': 14, '⑮': 15
}

/**
 * 检测文本是否是题号开头
 */
function isQuestionStart(text: string): { isQuestion: boolean; number?: number; confidence: number } {
  const trimmed = text.trim()
  
  // 圆圈数字单独处理
  for (const [char, num] of Object.entries(CIRCLE_NUM_MAP)) {
    if (trimmed.startsWith(char)) {
      return { isQuestion: true, number: num, confidence: 0.9 }
    }
  }
  
  for (const pattern of QUESTION_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      // 尝试提取题号数字
      let num: number | undefined
      if (match[1]) {
        // 中文数字转阿拉伯数字
        const chineseMap: Record<string, number> = {
          '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
          '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
        }
        num = chineseMap[match[1]] || parseInt(match[1], 10)
      }
      // 题号1-30范围内置信度高
      const confidence = (num && num >= 1 && num <= 30) ? 0.8 : 0.5
      return { isQuestion: true, number: num, confidence }
    }
  }
  
  return { isQuestion: false, confidence: 0 }
}

/**
 * 检测是否是大题标题（如"一、选择题"），并返回题型
 */
function isSectionTitle(text: string): { isSection: boolean; type?: string } {
  const trimmed = text.trim()
  
  // 选择题标题
  if (/[一二三四五六七八九十]\s*[、．\.]\s*选择/.test(trimmed) || 
      /选择题/.test(trimmed)) {
    return { isSection: true, type: 'choice' }
  }
  
  // 填空题标题
  if (/[一二三四五六七八九十]\s*[、．\.]\s*填空/.test(trimmed) ||
      /填空题/.test(trimmed)) {
    return { isSection: true, type: 'blank' }
  }
  
  // 解答题/计算题标题
  if (/[一二三四五六七八九十]\s*[、．\.]\s*(解答|计算|证明|应用|简答)/.test(trimmed) ||
      /(解答题|计算题|简答题)/.test(trimmed)) {
    return { isSection: true, type: 'answer' }
  }
  
  // 其他大题标题格式
  if (/^第\s*[一二三四五六七八九十\d]+\s*部分/.test(trimmed) ||
      /^Part\s*[IVX\d]+/i.test(trimmed)) {
    return { isSection: true, type: 'other' }
  }
  
  return { isSection: false }
}

/**
 * 检测是否是"注意事项"类标题（进入头部区域）
 */
function isHeaderTitle(text: string): boolean {
  const patterns = [
    /注意事项/,
    /考生须知/,
    /答题须知/,
    /考试说明/,
    /友情提示/
  ]
  return patterns.some(p => p.test(text.trim()))
}

/**
 * 检测是否是头部区域内容或干扰内容（非题目内容）
 */
function isHeaderContent(text: string): boolean {
  const excludePatterns = [
    /答[卷题]前/,
    /考试[结束时间]/,
    /本试[卷题]/,
    /答题卡/,
    /座位号/,
    /准考证/,
    /密封线/,
    /装订线/,
    /考试时间/,
    /满分.*分/,
    /选出.{0,10}答案后/,
    /用.{0,5}笔/,
    /涂.{0,5}答案/,
    /交回/,
    /一并交回/,
    /在此卷上答题无效/,
    /务必将/,
    /填写在/,
    /写在本/,
    /姓名/,
    /班级/,
    /学号/,
    /得分/,
    /评卷人/
  ]
  return excludePatterns.some(p => p.test(text))
}

/**
 * 检测是否是页脚/页码内容
 */
function isFooterContent(text: string): boolean {
  const footerPatterns = [
    /^\s*第\s*\d+\s*页/,           // 第1页
    /^\s*共\s*\d+\s*页/,           // 共4页
    /^\s*\d+\s*\/\s*\d+\s*$/,     // 1/4
    /^\s*-\s*\d+\s*-\s*$/,        // -1-
    /^[\d\-]+[A-Z]\d*$/,          // 24-387A1 这种编号
  ]
  return footerPatterns.some(p => p.test(text.trim()))
}

/**
 * 检测是否是边栏标注（学校、姓名等）
 */
function isSidebarContent(text: string): boolean {
  const sidebarPatterns = [
    /^\s*学校\s*$/,
    /^\s*姓名\s*$/,
    /^\s*班级\s*$/,
    /^\s*考号\s*$/,
    /^\s*密封线\s*$/,
    /^\s*装订线\s*$/,
    /^\s*[内外]\s*$/,
    /^\s*要\s*$/,
    /^\s*不\s*$/,
    /^\s*线\s*$/,
  ]
  return sidebarPatterns.some(p => p.test(text.trim()))
}

/**
 * 检测是否包含选项标识（A B C D）- 更宽松的匹配
 */
function hasChoiceOptions(text: string): boolean {
  // 多种选项格式
  const patterns = [
    /[ABCD]\s*[\.、．:：]/,       // A. B、C：
    /^\s*[ABCD]\s*[\.、．:：\s]/,  // 行首 A. 
    /[（(]\s*[ABCD]\s*[)）]/,     // (A) （B）
    /[ABCD]\s+[^ABCD\s]/,        // A 后跟内容
  ]
  return patterns.some(p => p.test(text))
}

/**
 * 检测后续若干行是否包含选项（验证选择题）
 */
function hasOptionsInFollowingLines(lines: Tesseract.Line[], startIndex: number, checkCount: number = 8): boolean {
  let optionCount = 0
  for (let i = startIndex; i < Math.min(startIndex + checkCount, lines.length); i++) {
    if (hasChoiceOptions(lines[i].text)) {
      optionCount++
      if (optionCount >= 2) return true  // 至少检测到2个选项
    }
  }
  return optionCount > 0
}

/**
 * 检测是否是真正的题目内容（更宽松）
 * 只要不是明显的干扰内容，就认为可能是题目
 */
function isValidQuestionContent(text: string): boolean {
  const trimmed = text.trim()
  
  // 排除明显的干扰项
  if (isHeaderContent(trimmed)) return false
  if (isFooterContent(trimmed)) return false
  if (isSidebarContent(trimmed)) return false
  
  // 太短的内容可能是干扰
  if (trimmed.length < 3) return false
  
  // 包含常见题目特征的内容
  const questionPatterns = [
    /[已若设如当则求等于为是的在有]/,    // 常见题目用词
    /[=≠<>≤≥\+\-×÷±√∞∈∩∪⊂⊃]/,      // 数学符号
    /\d/,                              // 包含数字
    /[（\(].+[）\)]/,                   // 包含括号内容
    /[ABCD][\s\.、．]/,                // 选项
    /[a-zA-Z]/,                        // 包含字母（变量）
  ]
  
  return questionPatterns.some(p => p.test(trimmed))
}

/**
 * 试卷切题器类 - V2 优化版
 */
export class QuestionSplitter {
  
  /**
   * 分析试卷图片，识别题目边界
   * 策略V2：宽松匹配 + 智能过滤
   * @param imageSource 图片源（base64或URL）
   * @param onProgress 进度回调
   */
  static async analyze(
    imageSource: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<QuestionBound[]> {
    onProgress?.(0, '正在进行OCR识别...')
    
    // 使用Tesseract识别，获取详细的行信息
    const result = await Tesseract.recognize(imageSource, 'chi_sim+eng', {
      logger: (info) => {
        if (info.status === 'recognizing text') {
          onProgress?.(Math.round(info.progress * 80), '正在识别文字...')
        }
      }
    })
    
    onProgress?.(80, '正在分析题目结构...')
    
    const lines = result.data.lines || []
    console.log('[QuestionSplitter V2] 开始分析，共', lines.length, '行')
    
    // 第一阶段：收集所有可能的题号候选
    const candidates: Array<{
      lineIndex: number
      questionNum: number
      line: Tesseract.Line
      text: string
      confidence: number
    }> = []
    
    // 第一次扫描：找出头部区域的结束位置
    let headerEndY = 0
    let foundSectionTitle = false
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineText = line.text.trim()
      if (!lineText) continue
      
      // 检测头部内容
      if (isHeaderTitle(lineText) || isHeaderContent(lineText)) {
        headerEndY = Math.max(headerEndY, line.bbox.y1)
        continue
      }
      
      // 检测大题标题
      const sectionCheck = isSectionTitle(lineText)
      if (sectionCheck.isSection) {
        foundSectionTitle = true
        headerEndY = Math.max(headerEndY, line.bbox.y0)  // 大题标题之前都是头部
        console.log('[QuestionSplitter V2] 检测到大题标题:', lineText, 'Y:', line.bbox.y0)
        continue
      }
    }
    
    console.log('[QuestionSplitter V2] 头部区域结束 Y:', headerEndY, '检测到大题标题:', foundSectionTitle)
    
    // 第二次扫描：收集所有题号候选
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineText = line.text.trim()
      if (!lineText) continue
      
      // 跳过头部区域
      if (line.bbox.y0 < headerEndY - 10) continue
      
      // 跳过干扰内容
      if (isFooterContent(lineText)) continue
      if (isSidebarContent(lineText)) continue
      if (isSectionTitle(lineText).isSection) continue
      
      // 检查是否是题号开头
      const checkResult = isQuestionStart(lineText)
      if (checkResult.isQuestion && checkResult.number) {
        candidates.push({
          lineIndex: i,
          questionNum: checkResult.number,
          line: line,
          text: lineText,
          confidence: checkResult.confidence
        })
        console.log('[QuestionSplitter V2] 候选题目', checkResult.number, ':', lineText.substring(0, 30))
      }
    }
    
    console.log('[QuestionSplitter V2] 找到', candidates.length, '个候选题目')
    
    // 第二阶段：智能过滤和验证
    const bounds: QuestionBound[] = []
    const usedNumbers = new Set<number>()
    
    for (const candidate of candidates) {
      const { questionNum, line, text, lineIndex } = candidate
      
      // 跳过重复题号（优先保留第一个）
      if (usedNumbers.has(questionNum)) {
        console.log('[QuestionSplitter V2] 跳过重复题号:', questionNum)
        continue
      }
      
      // 验证内容有效性
      if (!isValidQuestionContent(text)) {
        console.log('[QuestionSplitter V2] 跳过无效内容:', text.substring(0, 30))
        continue
      }
      
      // 检查题号顺序的合理性（不要求严格连续，但要递增）
      const lastNum = bounds.length > 0 ? bounds[bounds.length - 1].index : 0
      if (questionNum <= lastNum && questionNum !== 1) {
        // 题号倒退且不是新大题开始，可能是干扰
        console.log('[QuestionSplitter V2] 跳过题号倒退:', questionNum, '上一题:', lastNum)
        continue
      }
      
      // 如果是选择题，检查后续是否有选项
      const hasOptions = hasOptionsInFollowingLines(lines, lineIndex + 1)
      let questionType = hasOptions ? 'choice' : 'other'
      
      // 记录题目
      bounds.push({
        index: questionNum,
        y0: line.bbox.y0,
        y1: line.bbox.y1,
        text: text.substring(0, 30),
        fullText: text,
        questionType: questionType
      })
      
      usedNumbers.add(questionNum)
      console.log('[QuestionSplitter V2] 确认题目', questionNum, ':', text.substring(0, 20))
    }
    
    // 第三阶段：补充检测 - 如果题目数量过少，尝试更宽松的匹配
    if (bounds.length < 3 && candidates.length > bounds.length) {
      console.log('[QuestionSplitter V2] 题目数量过少，尝试放宽条件...')
      // 重新处理，跳过选项验证
      for (const candidate of candidates) {
        const { questionNum, line, text } = candidate
        if (usedNumbers.has(questionNum)) continue
        
        // 只需要满足递增条件
        const lastNum = bounds.length > 0 ? bounds[bounds.length - 1].index : 0
        if (questionNum > lastNum || questionNum === 1) {
          bounds.push({
            index: questionNum,
            y0: line.bbox.y0,
            y1: line.bbox.y1,
            text: text.substring(0, 30),
            fullText: text,
            questionType: 'unknown'
          })
          usedNumbers.add(questionNum)
          console.log('[QuestionSplitter V2] 放宽后确认题目', questionNum)
        }
      }
    }
    
    // 按题号排序
    bounds.sort((a, b) => a.index - b.index)
    
    // 计算每道题的结束位置（下一题的开始位置或图片底部）
    for (let i = 0; i < bounds.length; i++) {
      if (i < bounds.length - 1) {
        // 结束位置是下一题开始位置上方一点
        bounds[i].y1 = bounds[i + 1].y0 - 5
      } else {
        // 最后一题，结束位置是图片底部
        bounds[i].y1 = result.data.lines?.[result.data.lines.length - 1]?.bbox.y1 || bounds[i].y1 + 200
      }
    }
    
    onProgress?.(100, `识别到 ${bounds.length} 道题目`)
    console.log('[QuestionSplitter V2] 最终识别到', bounds.length, '道题目')
    
    return bounds
  }
  
  /**
   * 根据边界信息裁剪图片
   * @param imageSource 原始图片base64
   * @param bounds 题目边界列表
   * @param padding 上下边距
   */
  static async split(
    imageSource: string,
    bounds: QuestionBound[],
    padding: number = 10
  ): Promise<SplitResult> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const questions: SplitResult['questions'] = []
        
        for (const bound of bounds) {
          // 计算裁剪区域（添加边距）
          const y0 = Math.max(0, bound.y0 - padding)
          const y1 = Math.min(img.height, bound.y1 + padding)
          const height = y1 - y0
          
          // 使用Canvas裁剪
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = height
          
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('无法创建Canvas上下文'))
            return
          }
          
          // 绘制裁剪区域
          ctx.drawImage(
            img,
            0, y0,           // 源图起点
            img.width, height, // 源图尺寸
            0, 0,             // 目标起点
            img.width, height  // 目标尺寸
          )
          
          questions.push({
            index: bound.index,
            base64: canvas.toDataURL('image/png'),
            ocrText: bound.fullText || ''
          })
        }
        
        resolve({
          questions,
          originalWidth: img.width,
          originalHeight: img.height
        })
      }
      
      img.onerror = () => {
        reject(new Error('图片加载失败'))
      }
      
      img.src = imageSource
    })
  }
  
  /**
   * 一键切题：分析 + 裁剪
   * @param imageSource 图片源
   * @param onProgress 进度回调
   */
  static async autoSplit(
    imageSource: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<SplitResult> {
    // 分析题目边界
    const bounds = await this.analyze(imageSource, (p, s) => {
      onProgress?.(Math.round(p * 0.7), s)
    })
    
    if (bounds.length === 0) {
      throw new Error('未检测到题目，请确保图片中包含题号（如1. 2. 或一、二、）')
    }
    
    onProgress?.(70, `正在裁剪 ${bounds.length} 道题目...`)
    
    // 裁剪图片
    const result = await this.split(imageSource, bounds)
    
    onProgress?.(100, `切题完成，共 ${result.questions.length} 道`)
    
    return result
  }
}
