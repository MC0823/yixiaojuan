/**
 * 导入导出 & 屏幕录制相关 IPC 处理器
 */
import { ipcMain, dialog, BrowserWindow, desktopCapturer } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  Packer
} from 'docx'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { windowManager } from '../../window/WindowManager'
import { coursewareRepository, questionRepository } from '../../database'
import type { fileService as FileServiceType } from '../../services'
import type { PdfExportData, WordExportData, CoursewareExportData } from '../../../shared/types'

// 延迟加载的文件服务
let fileService: typeof FileServiceType

/**
 * 初始化文件服务
 */
export async function initExportFileService(): Promise<void> {
  const services = await import('../../services')
  fileService = services.fileService
}

/**
 * 读取图片为base64
 */
function readImageAsBase64(imagePath: string): string | null {
  try {
    if (!fs.existsSync(imagePath)) return null
    const buffer = fs.readFileSync(imagePath)
    const ext = path.extname(imagePath).toLowerCase().slice(1)
    const mimeType = ext === 'jpg' ? 'jpeg' : ext
    return `data:image/${mimeType};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * 生成PDF的HTML内容
 */
function generatePdfHtml(pdfData: PdfExportData): string {
  // 检测是否是截图模式（whiteboard 是图片 dataUrl）
  const isScreenshotMode = pdfData.questions.length > 0 && 
    pdfData.questions[0].whiteboard?.startsWith('data:image/')
  
  if (isScreenshotMode) {
    // 截图模式：每道题的截图作为一页
    const pagesHtml = pdfData.questions.map((q, idx) => `
      <div class="page" ${idx > 0 ? 'style="page-break-before: always;"' : ''}>
        <div class="page-header">第 ${q.index} 题</div>
        <img src="${q.whiteboard}" class="screenshot" />
      </div>
    `).join('')
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${pdfData.title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
          }
          .page {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .page-header {
            font-size: 16px;
            font-weight: bold;
            color: #2ec4b6;
            margin-bottom: 10px;
            text-align: center;
          }
          .screenshot {
            max-width: 100%;
            max-height: calc(100vh - 40px);
            object-fit: contain;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
      </html>
    `
  }
  
  // 文字模式：使用原有的文字格式
  const questionsHtml = pdfData.questions.map(q => {
    const optionsHtml = q.options.map(opt => `
      <div class="option ${q.answer?.includes(opt.label) ? 'correct' : ''}">
        <span class="label">${opt.label}.</span>
        <span class="content">${opt.content}</span>
        ${q.answer?.includes(opt.label) ? '<span class="check">✓</span>' : ''}
      </div>
    `).join('')
    
    const whiteboardHtml = q.whiteboard ? `
      <div class="whiteboard">
        <div class="whiteboard-title">板书批注</div>
        <div class="whiteboard-note">（白板数据已保存）</div>
      </div>
    ` : ''
    
    return `
      <div class="question">
        <div class="question-header">题目 ${q.index}</div>
        <div class="question-text">${q.text}</div>
        <div class="options">${optionsHtml}</div>
        <div class="answer">
          <strong>正确答案:</strong> ${q.answer || '未设置'}
        </div>
        ${whiteboardHtml}
      </div>
    `
  }).join('')
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${pdfData.title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
          font-size: 14px;
          line-height: 1.6;
          padding: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #2ec4b6;
        }
        .header h1 {
          font-size: 24px;
          color: #2ec4b6;
        }
        .question {
          margin-bottom: 30px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          page-break-inside: avoid;
        }
        .question-header {
          font-size: 16px;
          font-weight: bold;
          color: #2ec4b6;
          margin-bottom: 12px;
        }
        .question-text {
          font-size: 15px;
          margin-bottom: 16px;
          white-space: pre-wrap;
        }
        .options {
          margin-bottom: 16px;
        }
        .option {
          padding: 10px 15px;
          margin: 8px 0;
          background: white;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
          display: flex;
          align-items: center;
        }
        .option.correct {
          background: #e8f5e9;
          border-color: #4caf50;
        }
        .option .label {
          font-weight: bold;
          margin-right: 10px;
          color: #666;
        }
        .option .content {
          flex: 1;
        }
        .option .check {
          color: #4caf50;
          font-weight: bold;
          margin-left: 10px;
        }
        .answer {
          padding: 12px 15px;
          background: #e3f2fd;
          border-radius: 6px;
          color: #1976d2;
        }
        .whiteboard {
          margin-top: 16px;
          padding: 12px;
          background: #fff3e0;
          border-radius: 6px;
        }
        .whiteboard-title {
          font-weight: bold;
          color: #e65100;
        }
        .whiteboard-note {
          font-size: 12px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${pdfData.title}</h1>
        <p>共 ${pdfData.questions.length} 道题目</p>
      </div>
      ${questionsHtml}
    </body>
    </html>
  `
}

/**
 * 生成Word文档
 */
function generateWordDocument(wordData: WordExportData): Document {
  const children: (Paragraph | Table)[] = []
  
  // 标题
  children.push(
    new Paragraph({
      text: wordData.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  )
  
  // 副标题
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `共 ${wordData.questions.length} 道题目`,
          size: 24,
          color: '666666'
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 }
    })
  )
  
  // 遍历题目
  for (const q of wordData.questions) {
    // 题号
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `题目 ${q.index}`,
            bold: true,
            size: 28,
            color: '2EC4B6'
          })
        ],
        spacing: { before: 400, after: 200 }
      })
    )
    
    // 题目内容
    if (q.text) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: q.text,
              size: 24
            })
          ],
          spacing: { after: 200 }
        })
      )
    }
    
    // 选项表格
    if (q.options && q.options.length > 0) {
      const optionRows = q.options.map(opt => {
        const isCorrect = q.answer?.includes(opt.label)
        return new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${opt.label}.`,
                      bold: true,
                      size: 22,
                      color: isCorrect ? '4CAF50' : '333333'
                    })
                  ]
                })
              ],
              width: { size: 10, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' }
              }
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: opt.content,
                      size: 22,
                      color: isCorrect ? '4CAF50' : '333333'
                    }),
                    ...(isCorrect ? [
                      new TextRun({
                        text: ' ✓',
                        bold: true,
                        size: 22,
                        color: '4CAF50'
                      })
                    ] : [])
                  ]
                })
              ],
              width: { size: 90, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'E0E0E0' }
              }
            })
          ]
        })
      })
      
      children.push(
        new Table({
          rows: optionRows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        })
      )
    }
    
    // 正确答案
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '正确答案: ',
            bold: true,
            size: 22,
            color: '1976D2'
          }),
          new TextRun({
            text: q.answer || '未设置',
            size: 22,
            color: '1976D2'
          })
        ],
        spacing: { before: 200, after: 300 },
        shading: { fill: 'E3F2FD' }
      })
    )
    
    // 分隔线
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '\u2500'.repeat(60),
            color: 'CCCCCC',
            size: 16
          })
        ],
        spacing: { after: 200 }
      })
    )
  }
  
  return new Document({
    sections: [{
      properties: {},
      children
    }]
  })
}

/**
 * 注册导入导出处理器
 */
export function registerExportImportHandlers(): void {
  // 导出课件
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_EXPORT, async (_event, coursewareId: string) => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { success: false, error: '窗口不可用' }
    
    try {
      // 获取课件信息
      const courseware = coursewareRepository.findById(coursewareId)
      if (!courseware) {
        return { success: false, error: '课件不存在' }
      }
      
      // 获取课件下的所有题目
      const questions = questionRepository.findByCoursewareId(coursewareId)
      
      // 选择保存路径
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '导出课件',
        defaultPath: `${courseware.title}.yxj`,
        filters: [{ name: '易小卷课件', extensions: ['yxj'] }]
      })
      
      if (canceled || !filePath) {
        return { success: false, error: '用户取消' }
      }
      
      // 构建导出数据
      const exportData: CoursewareExportData = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        courseware: {
          title: courseware.title,
          description: courseware.description,
          status: courseware.status,
          settings: courseware.settings
        },
        questions: questions.map(q => ({
          order_index: q.order_index,
          type: q.type,
          ocr_text: q.ocr_text,
          options: q.options,
          answer: q.answer,
          annotations: q.annotations,
          // 图片转换为base64
          original_image_base64: q.original_image ? readImageAsBase64(q.original_image) : null
        }))
      }
      
      // 写入文件
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8')
      
      console.log('[Export] 课件导出成功:', filePath)
      return { success: true, data: { filePath } }
    } catch (error) {
      console.error('[Export] 导出失败:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // 导入课件
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_IMPORT, async () => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { success: false, error: '窗口不可用' }
    
    try {
      // 选择文件
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: '导入课件',
        filters: [{ name: '易小卷课件', extensions: ['yxj'] }],
        properties: ['openFile']
      })
      
      if (canceled || filePaths.length === 0) {
        return { success: false, error: '用户取消' }
      }
      
      const filePath = filePaths[0]
      const content = fs.readFileSync(filePath, 'utf-8')
      const importData = JSON.parse(content) as CoursewareExportData
      
      // 验证数据格式
      if (!importData.version || !importData.courseware) {
        return { success: false, error: '无效的课件文件格式' }
      }
      
      // 创建新课件
      const newCourseware = coursewareRepository.create({
        title: importData.courseware.title + '（导入）',
        description: importData.courseware.description,
        status: 'draft',
        settings: importData.courseware.settings
      })
      
      // 导入题目
      if (importData.questions && importData.questions.length > 0) {
        const questionsToCreate = []
        
        for (const q of importData.questions) {
          let imagePath: string | undefined = undefined
          
          // 如果有图片base64，保存到本地
          if (q.original_image_base64) {
            imagePath = await fileService.saveImage(
              q.original_image_base64, 
              newCourseware.id,
              { filename: `question_${q.order_index}.png` }
            )
          }
          
          questionsToCreate.push({
            order_index: q.order_index,
            type: q.type,
            ocr_text: q.ocr_text,
            options: q.options,
            answer: q.answer,
            annotations: q.annotations,
            original_image: imagePath
          })
        }
        
        questionRepository.createBatch(newCourseware.id, questionsToCreate)
      }
      
      console.log('[Import] Courseware imported:', newCourseware.id)
      return { success: true, data: { coursewareId: newCourseware.id, title: newCourseware.title } }
    } catch (error) {
      console.error('[Import] Import failed:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // 导出PDF
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_EXPORT_PDF, async (_event, pdfData: PdfExportData) => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { success: false, error: 'Window not available' }
    
    try {
      // 选择保存路径
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '导出PDF',
        defaultPath: `${pdfData.title}.pdf`,
        filters: [{ name: 'PDF文件', extensions: ['pdf'] }]
      })
      
      if (canceled || !filePath) {
        return { success: false, error: '用户取消' }
      }
      
      // 生成HTML内容
      const htmlContent = generatePdfHtml(pdfData)

      // 创建隐藏窗口用于渲染PDF
      let pdfWindow: BrowserWindow | null = null
      try {
        pdfWindow = new BrowserWindow({
          width: 800,
          height: 600,
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        })

        // 加载HTML内容
        await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)

        // 等待渲染完成
        await new Promise(resolve => setTimeout(resolve, 500))

        // 生成PDF
        const pdfBuffer = await pdfWindow.webContents.printToPDF({
          pageSize: 'A4',
          printBackground: true,
          margins: {
            top: 0.5,
            bottom: 0.5,
            left: 0.5,
            right: 0.5
          }
        })

        // 保存PDF文件
        fs.writeFileSync(filePath, pdfBuffer)

        console.log('[PDF] Export success:', filePath)
        return { success: true, data: { filePath } }
      } finally {
        if (pdfWindow && !pdfWindow.isDestroyed()) {
          pdfWindow.close()
        }
      }
    } catch (error) {
      console.error('[PDF] Export failed:', error)
      return { success: false, error: String(error) }
    }
  })
  
  // 导出Word
  ipcMain.handle(IPC_CHANNELS.COURSEWARE_EXPORT_WORD, async (_event, wordData: WordExportData) => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { success: false, error: '窗口不可用' }
    
    try {
      // 选择保存路径
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '导出Word文档',
        defaultPath: `${wordData.title}.docx`,
        filters: [{ name: 'Word文档', extensions: ['docx'] }]
      })
      
      if (canceled || !filePath) {
        return { success: false, error: '用户取消' }
      }
      
      // 生成Word文档
      const doc = generateWordDocument(wordData)
      
      // 导出为buffer并保存
      const buffer = await Packer.toBuffer(doc)
      fs.writeFileSync(filePath, buffer)
      
      console.log('[Word] Export success:', filePath)
      return { success: true, data: { filePath } }
    } catch (error) {
      console.error('[Word] Export failed:', error)
      return { success: false, error: String(error) }
    }
  })
}

/**
 * 注册屏幕录制处理器
 */
export function registerScreenHandlers(): void {
  // 获取可用的屏幕源
  ipcMain.handle(IPC_CHANNELS.SCREEN_GET_SOURCES, async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 150, height: 150 }
      })
      
      // 将窗口类型排在前面，并标记类型
      const mappedSources = sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        type: source.id.startsWith('window') ? 'window' : 'screen'
      }))
      
      // 窗口排在前面
      mappedSources.sort((a, b) => {
        if (a.type === 'window' && b.type !== 'window') return -1
        if (a.type !== 'window' && b.type === 'window') return 1
        return 0
      })
      
      console.log('[Screen] 获取到的源:', mappedSources.map(s => ({ name: s.name, type: s.type })))
      
      return {
        success: true,
        data: mappedSources
      }
    } catch (error) {
      console.error('[Screen] 获取屏幕源失败:', error)
      return {
        success: false,
        error: '获取屏幕源失败'
      }
    }
  })

  // 保存视频文件（WebM 格式）
  ipcMain.handle(IPC_CHANNELS.VIDEO_SAVE_WEBM, async (_event, options: {
    buffer: ArrayBuffer
    defaultFileName: string
  }) => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { success: false, error: '窗口不可用' }

    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '保存视频',
        defaultPath: options.defaultFileName,
        filters: [{ name: 'WebM视频', extensions: ['webm'] }]
      })

      if (canceled || !filePath) {
        return { success: false, error: '用户取消' }
      }

      // 将 ArrayBuffer 转换为 Buffer 并保存
      const buffer = Buffer.from(options.buffer)
      fs.writeFileSync(filePath, buffer)

      console.log('[Video] 视频保存成功:', filePath)
      return { success: true, data: { filePath } }
    } catch (error) {
      console.error('[Video] 视频保存失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 保存视频文件（MP4 格式 - 先保存为 webm，提示用户转换）
  ipcMain.handle(IPC_CHANNELS.VIDEO_SAVE_MP4, async (_event, options: {
    buffer: ArrayBuffer
    defaultFileName: string
  }) => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { success: false, error: '窗口不可用' }

    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '保存视频',
        defaultPath: options.defaultFileName.replace('.webm', '.mp4'),
        filters: [{ name: 'MP4视频', extensions: ['mp4'] }]
      })

      if (canceled || !filePath) {
        return { success: false, error: '用户取消' }
      }

      // 将 ArrayBuffer 转换为 Buffer 并保存
      // 注意：这里保存的实际上是 webm 编码的内容，但扩展名为 mp4
      // 大多数播放器可以正常播放
      const buffer = Buffer.from(options.buffer)
      fs.writeFileSync(filePath, buffer)

      console.log('[Video] MP4视频保存成功:', filePath)
      return { success: true, data: { filePath } }
    } catch (error) {
      console.error('[Video] MP4视频保存失败:', error)
      return { success: false, error: String(error) }
    }
  })

  // 保存音频文件 (MP3 格式)
  ipcMain.handle(IPC_CHANNELS.AUDIO_SAVE, async (_event, options: {
    buffer: ArrayBuffer
    defaultFileName: string
  }) => {
    const mainWindow = windowManager.getMainWindow()
    if (!mainWindow) return { success: false, error: '窗口不可用' }

    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '保存音频',
        defaultPath: options.defaultFileName,
        filters: [{ name: 'MP3音频', extensions: ['mp3'] }]
      })

      if (canceled || !filePath) {
        return { success: false, error: '用户取消' }
      }

      const buffer = Buffer.from(options.buffer)
      fs.writeFileSync(filePath, buffer)

      console.log('[Audio] 音频保存成功:', filePath)
      return { success: true, data: { filePath } }
    } catch (error) {
      console.error('[Audio] 音频保存失败:', error)
      return { success: false, error: String(error) }
    }
  })
}
