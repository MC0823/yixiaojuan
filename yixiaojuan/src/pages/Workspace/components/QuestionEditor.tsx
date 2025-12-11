/**
 * 题目编辑器组件
 * 右侧编辑面板，用于编辑题目内容
 */
import React from 'react'
import { Button, Input, Tooltip } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  CheckOutlined
} from '@ant-design/icons'
import { QuestionClassifier, type QuestionType } from '../../../utils/questionClassifier'
import styles from '../Workspace.module.less'

const { TextArea } = Input

interface QuestionData {
  id: string
  type?: string
  ocr_text?: string
  options?: string
  answer?: string
}

interface QuestionEditorProps {
  // 当前题目
  currentQuestion?: QuestionData
  currentIndex: number
  
  // 编辑状态
  ocrText: string
  options: { label: string; content: string }[]
  answer: string
  
  // 事件处理
  onOcrTextChange: (value: string) => void
  onTypeChange: (type: string) => void
  onAddOption: () => void
  onOptionChange: (index: number, content: string) => void
  onDeleteOption: (index: number) => void
  onToggleAnswer: (label: string) => void
  onAnswerChange: (value: string) => void
  onAddQuestion: () => void
  onDeleteQuestion: () => void
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  currentQuestion,
  currentIndex: _currentIndex,
  ocrText,
  options,
  answer,
  onOcrTextChange,
  onTypeChange,
  onAddOption,
  onOptionChange,
  onDeleteOption,
  onToggleAnswer,
  onAnswerChange,
  onAddQuestion,
  onDeleteQuestion
}) => {
  return (
    <div className={styles.editorContent}>
      <div className={styles.questionDetailPanel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelHeaderLeft}>
            <span className={styles.panelTitle}>题目详情</span>
            {currentQuestion?.type && (
              <span className={styles.questionTypeTag}>
                {QuestionClassifier.getTypeName(currentQuestion.type as QuestionType)}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="small"
              type="text"
              icon={<PlusOutlined />}
              onClick={onAddQuestion}
            >
              添加
            </Button>
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={onDeleteQuestion}
            >
              删除
            </Button>
          </div>
        </div>
        
        <div className={styles.questionContent}>
          {/* 题型切换 */}
          <div className={styles.typeSection}>
            <span className={styles.sectionLabel}>题型：</span>
            <div className={styles.typeButtons}>
              {[
                { key: 'choice', label: '选择题' },
                { key: 'multiChoice', label: '多选题' },
                { key: 'fillBlank', label: '填空题' },
                { key: 'trueFalse', label: '判断题' },
                { key: 'shortAnswer', label: '解答题' }
              ].map(t => (
                <Button
                  key={t.key}
                  size="small"
                  type={currentQuestion?.type === t.key ? 'primary' : 'default'}
                  onClick={() => onTypeChange(t.key)}
                  className={styles.typeBtn}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
          
          {/* 题干编辑 */}
          <div className={styles.stemSection}>
            <span className={styles.sectionLabel}>题干：</span>
            <TextArea
              value={ocrText}
              onChange={(e) => onOcrTextChange(e.target.value)}
              placeholder="请输入题目内容..."
              className={styles.questionEditor}
              autoSize={{ minRows: 3, maxRows: 8 }}
            />
          </div>
          
          {/* 选项编辑区 - 仅选择题/多选题/判断题显示 */}
          {(currentQuestion?.type === 'choice' ||
            currentQuestion?.type === 'multiChoice' ||
            currentQuestion?.type === 'trueFalse') && (
            <div className={styles.optionsSection}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionLabel}>
                  {currentQuestion?.type === 'trueFalse' ? '判断选项：' : '选项：'}
                </span>
                {currentQuestion?.type !== 'trueFalse' && (
                  <Button
                    type="link"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={onAddOption}
                  >
                    添加选项
                  </Button>
                )}
              </div>
              <div className={styles.optionsList}>
                {options.map((option, index) => (
                  <div
                    key={index}
                    className={`${styles.optionItem} ${styles.optionEditable} ${answer.includes(option.label) ? styles.optionSelected : ''}`}
                  >
                    {/* 选中正确答案按钮 */}
                    <Tooltip title={answer.includes(option.label) ? '取消正确答案' : '设为正确答案'}>
                      <div
                        className={`${styles.optionCheck} ${answer.includes(option.label) ? styles.checked : ''}`}
                        onClick={() => onToggleAnswer(option.label)}
                      >
                        {answer.includes(option.label) && <CheckOutlined />}
                      </div>
                    </Tooltip>
                    {/* 选项标签 */}
                    <span className={styles.optionLabel}>{option.label}.</span>
                    {/* 选项内容编辑 */}
                    <Input
                      value={option.content}
                      onChange={(e) => onOptionChange(index, e.target.value)}
                      placeholder="请输入选项内容"
                      className={styles.optionInput}
                    />
                    {/* 删除选项按钮 */}
                    {currentQuestion?.type !== 'trueFalse' && options.length > 2 && (
                      <Tooltip title="删除选项">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => onDeleteOption(index)}
                          className={styles.optionDeleteBtn}
                        />
                      </Tooltip>
                    )}
                  </div>
                ))}
              </div>
              {answer && (
                <div className={styles.answerDisplay}>
                  <div className={styles.answerIconWrapper}>
                    <CheckOutlined className={styles.answerIcon} />
                  </div>
                  <span className={styles.answerLabel}>正确答案</span>
                  <span className={styles.answerValue}>{answer}</span>
                </div>
              )}
            </div>
          )}
          
          {/* 填空题答案编辑 */}
          {currentQuestion?.type === 'fillBlank' && (
            <div className={styles.fillBlankSection}>
              <span className={styles.sectionLabel}>参考答案：</span>
              <Input
                value={answer}
                onChange={(e) => onAnswerChange(e.target.value)}
                placeholder="请输入填空题答案，多个空用 | 分隔"
                className={styles.answerInput}
              />
            </div>
          )}
          
          {/* 解答题答案编辑 */}
          {currentQuestion?.type === 'shortAnswer' && (
            <div className={styles.shortAnswerSection}>
              <span className={styles.sectionLabel}>参考答案：</span>
              <TextArea
                value={answer}
                onChange={(e) => onAnswerChange(e.target.value)}
                placeholder="请输入解答题参考答案..."
                className={styles.answerTextarea}
                autoSize={{ minRows: 2, maxRows: 6 }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
