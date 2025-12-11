/**
 * 导出弹窗组件
 * PDF导出选择弹窗和图片导出选择弹窗
 */
import React from 'react'
import { Modal, Checkbox, Divider, Tag } from 'antd'

interface Question {
  id: string
  ocr_text?: string
}

interface ExportModalsProps {
  // PDF导出
  questions: Question[]
  pdfExportModalVisible: boolean
  pdfExportMode: 'all' | 'annotated' | 'selected'
  selectedQuestions: number[]
  pdfExportScope: 'fullContent' | 'visibleArea'
  whiteboardData: Record<number, string>
  onPdfExportModalClose: () => void
  onPdfExportModeChange: (mode: 'all' | 'annotated' | 'selected') => void
  onSelectedQuestionsChange: (selected: number[]) => void
  onPdfExportScopeChange: (scope: 'fullContent' | 'visibleArea') => void
  onExecutePdfExport: () => void
  getAnnotatedQuestionIndices: () => number[]
  
  // 图片导出
  imageExportModalVisible: boolean
  imageExportScope: 'fullContent' | 'visibleArea'
  onImageExportModalClose: () => void
  onImageExportScopeChange: (scope: 'fullContent' | 'visibleArea') => void
  onExecuteImageExport: () => void
}

export const ExportModals: React.FC<ExportModalsProps> = ({
  questions,
  pdfExportModalVisible,
  pdfExportMode,
  selectedQuestions,
  pdfExportScope,
  whiteboardData,
  onPdfExportModalClose,
  onPdfExportModeChange,
  onSelectedQuestionsChange,
  onPdfExportScopeChange,
  onExecutePdfExport,
  getAnnotatedQuestionIndices,
  imageExportModalVisible,
  imageExportScope,
  onImageExportModalClose,
  onImageExportScopeChange,
  onExecuteImageExport
}) => {
  return (
    <>
      {/* PDF导出选择对话框 */}
      <Modal
        title="导出PDF"
        open={pdfExportModalVisible}
        onOk={onExecutePdfExport}
        onCancel={onPdfExportModalClose}
        okText="开始导出"
        cancelText="取消"
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <strong>选择导出题目：</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportMode"
                checked={pdfExportMode === 'all'}
                onChange={() => onPdfExportModeChange('all')}
                style={{ marginRight: 8 }}
              />
              全部导出 ({questions.length} 题)
            </label>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportMode"
                checked={pdfExportMode === 'annotated'}
                onChange={() => onPdfExportModeChange('annotated')}
                style={{ marginRight: 8 }}
              />
              只导出有批注的 ({getAnnotatedQuestionIndices().length} 题)
            </label>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportMode"
                checked={pdfExportMode === 'selected'}
                onChange={() => onPdfExportModeChange('selected')}
                style={{ marginRight: 8 }}
              />
              手动选择题目
            </label>
          </div>
        </div>
        
        {pdfExportMode === 'selected' && (
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 4, padding: 12, marginBottom: 16 }}>
            <Checkbox
              checked={selectedQuestions.length === questions.length}
              indeterminate={selectedQuestions.length > 0 && selectedQuestions.length < questions.length}
              onChange={(e) => {
                if (e.target.checked) {
                  onSelectedQuestionsChange(questions.map((_, i) => i))
                } else {
                  onSelectedQuestionsChange([])
                }
              }}
              style={{ marginBottom: 8 }}
            >
              全选
            </Checkbox>
            <Divider style={{ margin: '8px 0' }} />
            {questions.map((q, index) => (
              <div key={q.id} style={{ marginBottom: 4 }}>
                <Checkbox
                  checked={selectedQuestions.includes(index)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onSelectedQuestionsChange([...selectedQuestions, index].sort((a, b) => a - b))
                    } else {
                      onSelectedQuestionsChange(selectedQuestions.filter(i => i !== index))
                    }
                  }}
                >
                  题目 {index + 1}
                  {whiteboardData[index] && whiteboardData[index] !== '{}' && (
                    <Tag color="green" style={{ marginLeft: 8 }}>有批注</Tag>
                  )}
                </Checkbox>
              </div>
            ))}
          </div>
        )}
        
        <Divider style={{ margin: '16px 0' }} />
        
        <div>
          <div style={{ marginBottom: 12 }}>
            <strong>导出内容范围：</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportScope"
                checked={pdfExportScope === 'fullContent'}
                onChange={() => onPdfExportScopeChange('fullContent')}
                style={{ marginRight: 8 }}
              />
              全部书写内容（包含超出可见区域的部分）
            </label>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportScope"
                checked={pdfExportScope === 'visibleArea'}
                onChange={() => onPdfExportScopeChange('visibleArea')}
                style={{ marginRight: 8 }}
              />
              仅可见区域
            </label>
          </div>
        </div>
      </Modal>

      {/* 图片导出选择对话框 */}
      <Modal
        title="导出图片"
        open={imageExportModalVisible}
        onOk={onExecuteImageExport}
        onCancel={onImageExportModalClose}
        okText="开始导出"
        cancelText="取消"
        width={400}
      >
        <div>
          <div style={{ marginBottom: 12 }}>
            <strong>导出内容范围：</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="imageExportScope"
                checked={imageExportScope === 'fullContent'}
                onChange={() => onImageExportScopeChange('fullContent')}
                style={{ marginRight: 8 }}
              />
              全部书写内容（包含超出可见区域的部分）
            </label>
            <label style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="imageExportScope"
                checked={imageExportScope === 'visibleArea'}
                onChange={() => onImageExportScopeChange('visibleArea')}
                style={{ marginRight: 8 }}
              />
              仅可见区域
            </label>
          </div>
          <div style={{ marginTop: 16, color: '#666', fontSize: 13 }}>
            💡 如果您在白板上拖动后书写了内容，选择"全部书写内容"可以导出所有内容。
          </div>
        </div>
      </Modal>
    </>
  )
}
