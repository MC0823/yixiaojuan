/**
 * 题目卡片组件
 * 左侧显示当前题目内容、选项和批改区域
 */
import React from 'react'
import { Button, Input, Tag, Tooltip } from 'antd'
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  CheckOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FormOutlined,
  PlusOutlined,
  HolderOutlined,
  RightOutlined
} from '@ant-design/icons'
import type { OptionItem } from '../hooks'
import styles from '../Presentation.module.less'

interface QuestionData {
  id: string
  ocr_text?: string
  answer?: string
  options?: string
}

interface QuestionCardProps {
  // 数据
  currentIndex: number
  currentQuestion?: QuestionData
  currentOptions: OptionItem[]
  
  // 显示状态
  showAnswer: boolean
  isWhiteboardFullscreen: boolean
  isLeftPanelVisible: boolean
  
  // 批改模式
  isGradingMode: boolean
  currentStudentAnswer: string
  currentGradingResult: boolean | null | undefined
  gradingResults: Record<number, boolean | null>
  
  // 样式
  leftWidth: number
  
  // 事件处理
  onToggleAnswer: () => void
  onToggleGradingMode: () => void
  onToggleLeftPanel: () => void
  onSetStudentAnswer: (answer: string) => void
  onGradeCurrentQuestion: () => void
  onGradeAllQuestions: () => void
  onInsertQuestionToCanvas: (index: number) => void
  onDragStartQuestion: (e: React.DragEvent) => void
  onDragStartStem: (e: React.DragEvent) => void
  onDragStartOption: (e: React.DragEvent, option: OptionItem) => void
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  currentIndex,
  currentQuestion,
  currentOptions,
  showAnswer,
  isWhiteboardFullscreen,
  isLeftPanelVisible,
  isGradingMode,
  currentStudentAnswer,
  currentGradingResult,
  gradingResults,
  leftWidth,
  onToggleAnswer,
  onToggleGradingMode,
  onToggleLeftPanel,
  onSetStudentAnswer,
  onGradeCurrentQuestion,
  onGradeAllQuestions,
  onInsertQuestionToCanvas,
  onDragStartQuestion,
  onDragStartStem,
  onDragStartOption
}) => {
  return (
    <div
      className={`${styles.leftPanel} ${isWhiteboardFullscreen ? styles.leftPanelFullscreen : ''} ${isWhiteboardFullscreen && isLeftPanelVisible ? styles.leftPanelVisible : ''}`}
      style={{ width: isWhiteboardFullscreen ? '400px' : `${leftWidth}%` }}
    >
      {isWhiteboardFullscreen && (
        <div className={styles.leftPanelHandle} onClick={onToggleLeftPanel}>
          <RightOutlined style={{ transform: isLeftPanelVisible ? 'rotate(180deg)' : 'none' }} />
        </div>
      )}
      <div
        className={styles.questionCard}
        draggable
        onDragStart={onDragStartQuestion}
      >
        <div className={styles.cardHeader}>
          <div className={styles.dragHandle}>
            <HolderOutlined />
          </div>
          <span className={styles.questionLabel}>题目 {currentIndex + 1}</span>
          <Tooltip title="插入到画布">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              className={styles.insertBtn}
              onClick={() => onInsertQuestionToCanvas(currentIndex)}
            />
          </Tooltip>
        </div>
        
        <div className={styles.cardContent}>
          <div 
            className={styles.questionText}
            draggable
            onDragStart={onDragStartStem}
            title="拖拽题干到画布"
            style={{ cursor: 'grab' }}
          >
            <div className={styles.dragHint}>
              <HolderOutlined />
            </div>
            {currentQuestion?.ocr_text || '暂无题目内容'}
          </div>
        </div>
        
        {/* 选项列表 */}
        <div className={styles.optionsArea}>
          {currentOptions.map((opt) => (
            <div
              key={opt.label}
              className={`${styles.optionCard} ${showAnswer && currentQuestion?.answer?.includes(opt.label) ? styles.correct : ''} ${isGradingMode && currentStudentAnswer.includes(opt.label) ? (currentGradingResult === true ? styles.correct : currentGradingResult === false ? styles.wrong : styles.selected) : ''}`}
              draggable
              onDragStart={(e) => onDragStartOption(e, opt)}
              onClick={() => {
                if (isGradingMode) {
                  const currentAnswer = currentStudentAnswer
                  if (currentAnswer.includes(opt.label)) {
                    onSetStudentAnswer(currentAnswer.replace(opt.label, ''))
                  } else {
                    onSetStudentAnswer(currentAnswer + opt.label)
                  }
                }
              }}
              style={{ cursor: isGradingMode ? 'pointer' : 'grab' }}
              title="拖拽选项到画布"
            >
              <div className={styles.optionDragHandle}>
                <HolderOutlined />
              </div>
              <span className={styles.optionLabel}>{opt.label}.</span>
              <span className={styles.optionText}>{opt.content}</span>
              {showAnswer && currentQuestion?.answer?.includes(opt.label) && (
                <CheckOutlined className={styles.optionCheck} />
              )}
            </div>
          ))}
        </div>
        
        {/* 正确答案显示卡片 */}
        {showAnswer && currentQuestion?.answer && (
          <div className={styles.correctAnswerCard}>
            <div className={styles.answerIconWrapper}>
              <CheckOutlined className={styles.answerIcon} />
            </div>
            <div className={styles.answerContent}>
              <span className={styles.answerTitle}>正确答案</span>
              <span className={styles.answerValue}>{currentQuestion.answer}</span>
            </div>
          </div>
        )}
        
        {/* 答案显示按钮 & 批改模式 */}
        <div className={styles.answerSection}>
          <Button
            type={showAnswer ? 'primary' : 'default'}
            icon={showAnswer ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            onClick={onToggleAnswer}
          >
            {showAnswer ? '隐藏答案' : '显示答案'}
          </Button>
          
          <Button
            type={isGradingMode ? 'primary' : 'default'}
            icon={<FormOutlined />}
            onClick={onToggleGradingMode}
          >
            {isGradingMode ? '退出批改' : '批改模式'}
          </Button>
        </div>
        
        {/* 批改模式输入区 */}
        {isGradingMode && (
          <div className={styles.gradingSection}>
            <div className={styles.gradingInput}>
              <span className={styles.gradingLabel}>学生答案：</span>
              <Input
                value={currentStudentAnswer}
                onChange={(e) => onSetStudentAnswer(e.target.value)}
                placeholder="点击选项或输入答案"
                onPressEnter={onGradeCurrentQuestion}
              />
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={onGradeCurrentQuestion}
              >
                判分
              </Button>
              <Button onClick={onGradeAllQuestions}>
                全部判分
              </Button>
            </div>
            
            {/* 判分结果显示 */}
            {currentGradingResult !== null && currentGradingResult !== undefined && (
              <div className={styles.gradingResult}>
                {currentGradingResult ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">
                    回答正确
                  </Tag>
                ) : (
                  <Tag icon={<CloseCircleOutlined />} color="error">
                    回答错误，正确答案: {currentQuestion?.answer}
                  </Tag>
                )}
              </div>
            )}
            
            {/* 判分统计 */}
            {Object.keys(gradingResults).length > 0 && (
              <div className={styles.gradingStats}>
                已判: {Object.values(gradingResults).filter(r => r !== null).length} 题
                {' | '}
                正确: {Object.values(gradingResults).filter(r => r === true).length} 题
                {' | '}
                错误: {Object.values(gradingResults).filter(r => r === false).length} 题
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
