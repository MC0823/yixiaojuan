/**
 * 题型分类与解析工具
 * 支持自动识别题型、解析选项、分离题干
 */

export type QuestionType = 'choice' | 'multiChoice' | 'trueFalse' | 'fillBlank' | 'shortAnswer' | 'essay';

/**
 * 选项结构
 */
export interface OptionItem {
  label: string;   // A, B, C, D...
  content: string; // 选项内容
}

/**
 * 解析结果
 */
export interface ParsedQuestion {
  type: QuestionType;          // 题型
  questionNumber: number | null; // 题号
  stem: string;                 // 题干（不含选项）
  options: OptionItem[];        // 选项列表
  rawText: string;              // 原始OCR文本
}

/**
 * 题型分类器
 */
export class QuestionClassifier {
  
  // 选项匹配模式（支持多种格式）
  private static readonly OPTION_PATTERNS = [
    /([A-D])[.、]\s*([^A-D\n]+?)(?=(?:[A-D][.、])|$)/gis,     // A. 内容 或 A、内容
    /[(（]([A-D])[)）]\s*([^A-D\n]+?)(?=(?:[(（][A-D])|$)/gis, // (A) 内容
    /([A-D])[:：]\s*([^A-D\n]+?)(?=(?:[A-D][:：])|$)/gis,     // A: 内容
  ];
  
  // 题号匹配模式
  private static readonly NUMBER_PATTERNS = [
    /^\s*(\d+)\s*[.、\)]\s*/m,                    // 1. 或 1、 或 1)
    /^\s*第\s*(\d+)\s*题/m,                        // 第1题
    /^\s*[(（](\d+)[)）]/m,                         // (1)
  ];

  /**
   * 完整解析题目
   * 返回结构化的题目数据，包含题型、题干、选项等
   */
  static parse(text: string): ParsedQuestion {
    const type = this.classify(text);
    const questionNumber = this.extractNumber(text);
    const options = this.extractOptions(text);
    const stem = this.extractStem(text, options);
    
    return {
      type,
      questionNumber,
      stem,
      options,
      rawText: text
    };
  }

  /**
   * 自动分类题型
   * @param text - OCR识别的文本
   * @returns 题型类型
   */
  static classify(text: string): QuestionType {
    const normalizedText = text.toLowerCase();
    
    // 1. 判断题特征检测
    const trueFalsePatterns = [
      /[(（]\s*[对错√×✓✗]\s*[)）]/,           // (对) (错) (√) (×)
      /\b(true|false)\b/i,                        // True/False
      /判断.*[对错]/,                               // 判断...(对/错)
      /[对错]\s*[(（]\s*[)）]/,                     // 对( ) 错( )
    ];
    
    if (trueFalsePatterns.some(p => p.test(normalizedText))) {
      return 'trueFalse';
    }
    
    // 2. 选择题特征检测
    const options = this.extractOptions(text);
    if (options.length >= 2) {
      // 检测是否多选题
      const multiChoicePatterns = [
        /多选/,
        /不正确的有/,
        /正确的有.*项/,
        /选择.*两个/,
        /全部选择/,
      ];
      
      if (multiChoicePatterns.some(p => p.test(normalizedText))) {
        return 'multiChoice';
      }
      
      return 'choice';
    }

    // 3. 填空题特征检测
    const fillBlankPatterns = [
      /_{2,}/,                      // 下划线 __
      /[(（]\s{2,}[)）]/,            // 空括号 (  )
      /\[\s{2,}\]/,                  // 空方括号 [  ]
      /填空/,                        // 包含"填空"关键词
    ];

    if (fillBlankPatterns.some(pattern => pattern.test(text))) {
      return 'fillBlank';
    }
    
    // 4. 简答题特征
    const shortAnswerPatterns = [
      /简答/,
      /简述/,
      /请简要/,
    ];
    
    if (shortAnswerPatterns.some(p => p.test(normalizedText))) {
      return 'shortAnswer';
    }

    // 5. 默认为解答题/论述题
    return 'essay';
  }

  /**
   * 提取选项内容（结构化）
   * @param text - 题目文本
   * @returns 选项数组
   */
  static extractOptions(text: string): OptionItem[] {
    const options: OptionItem[] = [];
    const foundLabels = new Set<string>();
    
    // 尝试每种模式
    for (const pattern of this.OPTION_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const label = match[1].toUpperCase();
        let content = match[2]?.trim() || '';
        
        // 清理选项内容（移除尾部多余字符）
        content = content.replace(/\s+/g, ' ').trim();
        
        // 避免重复添加
        if (!foundLabels.has(label) && content.length > 0) {
          foundLabels.add(label);
          options.push({ label, content });
        }
      }
      
      // 如果已找到选项，不再尝试其他模式
      if (options.length >= 2) break;
    }
    
    // 按标签排序
    options.sort((a, b) => a.label.localeCompare(b.label));
    
    return options;
  }
  
  /**
   * 提取题干（移除选项部分）
   */
  static extractStem(text: string, options: OptionItem[]): string {
    if (options.length === 0) {
      // 没有选项，返回清理后的全文
      return this.cleanText(text);
    }
    
    // 查找第一个选项的位置
    const firstOptionLabel = options[0].label;
    const patterns = [
      new RegExp(`${firstOptionLabel}[.、]`, 'i'),
      new RegExp(`[(（]${firstOptionLabel}[)）]`, 'i'),
      new RegExp(`${firstOptionLabel}[:：]`, 'i'),
    ];
    
    let stemEndIndex = text.length;
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match && match.index < stemEndIndex) {
        stemEndIndex = match.index;
      }
    }
    
    const stem = text.substring(0, stemEndIndex);
    return this.cleanText(stem);
  }
  
  /**
   * 清理文本
   */
  private static cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')           // 多个空白合并
      .replace(/^\s*\d+[.、\)]\s*/, '') // 移除开头的题号
      .trim();
  }

  /**
   * 提取选项内容（简单数组版本，向后兼容）
   * @param text - 题目文本
   * @returns 选项内容数组
   */
  static extractChoices(text: string): string[] {
    return this.extractOptions(text).map(opt => opt.content);
  }

  /**
   * 提取题目编号
   * @param text - 题目文本
   * @returns 题目编号
   */
  static extractNumber(text: string): number | null {
    for (const pattern of this.NUMBER_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }
    return null;
  }
  
  /**
   * 获取题型显示名称
   */
  static getTypeName(type: QuestionType): string {
    const typeNames: Record<QuestionType, string> = {
      'choice': '单选题',
      'multiChoice': '多选题',
      'trueFalse': '判断题',
      'fillBlank': '填空题',
      'shortAnswer': '简答题',
      'essay': '解答题'
    };
    return typeNames[type] || '未知题型';
  }
}
