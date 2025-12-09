/**
 * 上传页面
 * 支持图片选择、预览、OCR识别、自动切题、创建课件
 */
import { useState, useCallback } from 'react'
import { Card, Upload, Typography, Space, message, Button, Image, Progress, Spin, Input, Modal, Alert } from 'antd'
import { InboxOutlined, PlusOutlined, DeleteOutlined, EyeOutlined, ScanOutlined, FileAddOutlined, ScissorOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { useNavigate } from 'react-router-dom'
import { recognizeImage } from '../../services/ocrService'
import { QuestionClassifier, type QuestionType } from '../../utils/questionClassifier'
import { ErrorHandler } from '../../utils/errorHandler'
import { useImageUpload } from '../../components/upload'
import { CoursewarePreviewModal } from '../../components/courseware/CoursewarePreviewModal'
import styles from './Upload.module.less'

const { Title, Paragraph, Text } = Typography
const { Dragger } = Upload

// 类型直接使用 UploadImageItem

function UploadPage() {
  const navigate = useNavigate()
  
  // 使用公共 hook 管理图片上传
  const {
    images,
    setImages,
    isSelecting,
    isSplitting,
    splitProgress,
    previewVisible,
    previewImage,
    handleSelectImages,
    handleRemoveImage,
    handlePreviewImage,
    handleClosePreview,
    handleAutoSplit
  } = useImageUpload()
  
  // 课件创建相关状态
  const [isCreating, setIsCreating] = useState(false)
  const [coursewareTitle, setCoursewareTitle] = useState('')
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  /**
   * OCR识别单张图片（在渲染进程中运行）
   */
  const handleOcrSingle = useCallback(async (id: string) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, isProcessing: true, ocrProgress: 0 } : img
    ))
    
    try {
      const image = images.find(img => img.id === id)
      if (!image) return
      
      // 准备图片数据
      let imageSource = image.base64Data || image.thumbnail
      
      // 如果没有 base64 数据，通过 IPC 获取
      if (!imageSource && window.electronAPI) {
        const result = await window.electronAPI.image.getInfo(image.path, true)
        if (result.success && result.data?.base64) {
          imageSource = result.data.base64
        }
      }
      
      if (!imageSource) {
        throw new Error('无法获取图片数据')
      }
      
      // 在渲染进程中直接使用 Tesseract.js 进行 OCR 识别
      const result = await recognizeImage(
        imageSource,
        'chi_sim+eng',
        (progress) => {
          setImages(prev => prev.map(img =>
            img.id === id ? { ...img, ocrProgress: progress } : img
          ))
        }
      )

      // 自动分类题型
      const questionType = QuestionClassifier.classify(result.text)
      const questionNumber = QuestionClassifier.extractNumber(result.text)

      setImages(prev => prev.map(img =>
        img.id === id ? {
          ...img,
          ocrText: result.text || '',
          questionType,
          questionNumber: questionNumber || undefined,
          isProcessing: false,
          ocrProgress: 100
        } : img
      ))
      message.success(`OCR识别完成 - ${QuestionClassifier.getTypeName(questionType)}`)
    } catch (error) {
      ErrorHandler.handle(error as Error, 'OCR识别')
      setImages(prev => prev.map(img =>
        img.id === id ? { ...img, isProcessing: false } : img
      ))
    }
  }, [images])

  /**
   * 批量OCR识别
   */
  const handleOcrAll = useCallback(async () => {
    if (images.length === 0) return
    
    for (const image of images) {
      if (!image.ocrText) {
        await handleOcrSingle(image.id)
      }
    }
  }, [images, handleOcrSingle])

  /**
   * 处理预览确认
   */
  const handlePreviewConfirm = useCallback(async (mode: 'merge' | 'separate', selectedGroups?: string[]) => {
    setShowPreviewModal(false)

    if (mode === 'merge') {
      setShowTitleModal(true)
    } else if (selectedGroups && selectedGroups.length > 0) {
      for (const groupName of selectedGroups) {
        setCoursewareTitle(groupName)
        const groupImages = images.filter(img => img.sourceImage === groupName)
        await createSingleCourseware(groupName, groupImages)
      }
      message.success(`成功创建 ${selectedGroups.length} 个课件`)
      navigate('/')
    }
  }, [images])

  /**
   * 创建单个课件
   */
  const createSingleCourseware = useCallback(async (title: string, coursewareImages: typeof images) => {
    if (coursewareImages.length === 0) {
      message.warning('请先添加图片')
      return
    }

    if (!title.trim()) {
      message.warning('请输入课件名称')
      return
    }

    setIsCreating(true)
    
    try {
      if (!window.electronAPI) {
        message.error('请在 Electron 环境中运行')
        return
      }
      
      console.log('[Upload] 开始创建课件, 图片数量:', coursewareImages.length)

      // 1. 创建课件
      const coursewareResult = await window.electronAPI.courseware.create({
        title: title.trim(),
        status: 'draft'
      })

      if (!coursewareResult.success || !coursewareResult.data) {
        throw new Error(coursewareResult.error || '创建课件失败')
      }

      const coursewareId = coursewareResult.data.id
      console.log('[Upload] 课件创建成功, ID:', coursewareId)

      // 2. 保存图片到课件目录
      // 区分两种情况：有完整路径的图片（系统对话框选择）和只有 base64 的图片（拖拽上传）
      const savedPaths: string[] = []

      for (let i = 0; i < coursewareImages.length; i++) {
        const img = coursewareImages[i]
        console.log(`[Upload] 处理图片 ${i + 1}/${coursewareImages.length}:`, img.name, 'path:', img.path, 'hasBase64:', !!img.base64Data)
        
        // 判断是否是完整路径（包含路径分隔符）
        const isFullPath = img.path.includes('/') || img.path.includes('\\')
        
        if (isFullPath) {
          // 有完整路径，使用复制方式
          console.log('[Upload] 使用复制方式')
          const copyResult = await window.electronAPI.image.copyToCourseware([img.path], coursewareId)
          if (copyResult.success && copyResult.data && copyResult.data[0]) {
            savedPaths.push(copyResult.data[0])
            console.log('[Upload] 复制成功:', copyResult.data[0])
          } else {
            console.error('[Upload] 复制失败:', copyResult.error)
            throw new Error(`复制图片失败: ${img.name}`)
          }
        } else if (img.base64Data) {
          // 只有 base64 数据（拖拽上传），直接保存
          console.log('[Upload] 使用base64保存方式')
          const ext = img.name.split('.').pop() || 'png'
          const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`
          const saveResult = await window.electronAPI.image.save(img.base64Data, coursewareId, filename)
          if (saveResult.success && saveResult.data) {
            savedPaths.push(saveResult.data)
            console.log('[Upload] 保存成功:', saveResult.data)
          } else {
            console.error('[Upload] 保存失败:', saveResult.error)
            throw new Error(`保存图片失败: ${img.name}`)
          }
        } else {
          console.error('[Upload] 图片数据无效:', img)
          throw new Error(`图片数据无效: ${img.name}`)
        }
      }
      
      console.log('[Upload] 所有图片保存完成, 路径:', savedPaths)
      
      // 3. 创建题目记录（使用服务端解析的数据）
      const questions = coursewareImages.map((img, index) => {
        // 优先使用服务端解析的题干和选项
        const stem = img.stem || img.ocrText || ''
        const options = img.options || []
        
        // 根据选项数量判断题型
        let type: QuestionType = 'shortAnswer'
        if (options.length >= 2) {
          type = 'choice'
        }
        
        return {
          original_image: savedPaths[index],
          ocr_text: stem,
          type: type,
          options: JSON.stringify(options),
          order_index: index
        }
      })
      
      console.log('[Upload] 创建题目:', questions)
      const questionResult = await window.electronAPI.question.createBatch(coursewareId, questions)
      console.log('[Upload] 题目创建结果:', questionResult)
      
      if (!questionResult.success) {
        throw new Error(questionResult.error || '创建题目失败')
      }
      
      message.success('课件创建成功！')

      // 4. 跳转到主页并选中课件
      navigate(`/?coursewareId=${coursewareId}`)

    } catch (error) {
      console.error('[Upload] 创建课件失败:', error)
      message.error('创建课件失败: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setIsCreating(false)
    }
  }, [navigate])

  /**
   * 合并模式：创建单个课件包含所有图片
   */
  const handleCreateCourseware = useCallback(async () => {
    setShowTitleModal(false)
    await createSingleCourseware(coursewareTitle, images)
  }, [coursewareTitle, images, createSingleCourseware])

  /**
   * Ant Upload 拖拽上传配置
   */
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: 'image/*',
    showUploadList: false,
    beforeUpload: async (file) => {
      // 将拖拽的文件转换为图片项
      const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // 读取文件为Base64
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target?.result as string
        setImages(prev => [...prev, {
          id,
          path: file.name, // 浏览器环境无法获取完整路径
          name: file.name,
          thumbnail: base64,
          base64Data: base64  // 保存 base64 数据用于 OCR 识别
        }])
      }
      reader.readAsDataURL(file)
      
      return false // 阻止默认上传
    }
  }

  return (
    <div className={styles.container}>
      <Card 
        className={styles.uploadCard}
        styles={{
          header: { background: 'transparent', borderColor: 'rgba(255,255,255,0.25)' },
          body: { background: 'transparent' }
        }}
        style={{
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: 16
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%', background: 'transparent' }}>
          <div className={styles.header}>
            <Title level={3} style={{ margin: 0, color: 'white' }}>上传试卷</Title>
            <Paragraph style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              选择试卷图片，系统将自动识别题目内容并生成课件
            </Paragraph>
          </div>
          
          {images.length === 0 ? (
            <Dragger {...uploadProps} className={styles.dragger}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 48 }} />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持单个或批量上传试卷图片
              </p>
            </Dragger>
          ) : (
            <div className={styles.imageList}>
              {images.map((img, index) => (
                <div key={img.id} className={styles.imageItem}>
                  <div className={styles.imageIndex}>{index + 1}</div>
                  <div className={styles.imageThumbnail}>
                    {img.thumbnail ? (
                      <img src={img.thumbnail} alt={img.name} />
                    ) : (
                      <Spin size="small" />
                    )}
                  </div>
                  <div className={styles.imageInfo}>
                    <Text ellipsis className={styles.imageName}>{img.name}</Text>
                    {img.isProcessing && (
                      <Progress percent={img.ocrProgress || 0} size="small" />
                    )}
                    {img.ocrText && (
                      <Text type="secondary" ellipsis className={styles.ocrPreview}>
                        {img.ocrText.substring(0, 50)}...
                      </Text>
                    )}
                  </div>
                  <div className={styles.imageActions}>
                    <Button 
                      type="text" 
                      icon={<EyeOutlined />}
                      onClick={() => handlePreviewImage(img)}
                      title="预览"
                    />
                    <Button 
                      type="text" 
                      icon={<ScissorOutlined />}
                      onClick={() => handleAutoSplit(img.id)}
                      loading={isSplitting}
                      title="自动切题"
                    />
                    <Button 
                      type="text" 
                      icon={<ScanOutlined />}
                      onClick={() => handleOcrSingle(img.id)}
                      loading={img.isProcessing}
                      title="OCR识别"
                    />
                    <Button 
                      type="text" 
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveImage(img.id)}
                      title="删除"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* 切题进度提示 */}
          {isSplitting && (
            <Alert
              type="info"
              message="正在自动切题"
              description={
                <div>
                  <Progress percent={splitProgress.percent} size="small" />
                  <span>{splitProgress.status}</span>
                </div>
              }
              style={{ marginBottom: 16 }}
            />
          )}
          
          {/* 提示信息 */}
          {images.length === 1 && !images[0].ocrText && (
            <Alert
              type="info"
              message="提示：如果这是一张包含多道题目的试卷，可以点击图片右侧的 ✂️ 按钮自动切分成多道题"
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}
          
          <div className={styles.actions}>
            <Button 
              icon={<PlusOutlined />}
              onClick={handleSelectImages}
              loading={isSelecting}
            >
              添加图片
            </Button>
            <Button 
              icon={<ScanOutlined />}
              onClick={handleOcrAll}
              disabled={images.length === 0}
            >
              批量OCR识别
            </Button>
            <Button
              type="primary"
              icon={<FileAddOutlined />}
              onClick={() => setShowPreviewModal(true)}
              disabled={images.length === 0}
              loading={isCreating}
            >
              创建课件
            </Button>
          </div>
        </Space>
      </Card>
      
      {/* 图片预览 */}
      <Image
        style={{ display: 'none' }}
        preview={{
          visible: previewVisible,
          src: previewImage,
          onVisibleChange: (visible) => !visible && handleClosePreview()
        }}
      />
      
      {/* 课件预览和分组选择 */}
      <CoursewarePreviewModal
        visible={showPreviewModal}
        images={images}
        onConfirm={handlePreviewConfirm}
        onCancel={() => setShowPreviewModal(false)}
      />

      {/* 课件名称弹窗 */}
      <Modal
        title="创建课件"
        open={showTitleModal}
        onOk={handleCreateCourseware}
        onCancel={() => setShowTitleModal(false)}
        okText="创建"
        cancelText="取消"
        confirmLoading={isCreating}
      >
        <Input
          placeholder="请输入课件名称"
          value={coursewareTitle}
          onChange={(e) => setCoursewareTitle(e.target.value)}
          onPressEnter={handleCreateCourseware}
        />
      </Modal>
    </div>
  )
}

export default UploadPage
