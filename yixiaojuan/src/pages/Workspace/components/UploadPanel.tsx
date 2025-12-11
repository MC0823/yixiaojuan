/**
 * 上传面板组件
 * 用于上传和管理试卷图片
 */
import React from 'react'
import { Button, Spin, Progress, Alert, Typography, Upload } from 'antd'
import type { UploadProps } from 'antd'
import {
  PlusOutlined,
  CloseOutlined,
  InboxOutlined,
  EyeOutlined,
  ScanOutlined,
  ClearOutlined,
  DeleteOutlined,
  FileAddOutlined,
  RotateRightOutlined,
  StopOutlined
} from '@ant-design/icons'
import type { UploadImageItem } from '../../../components/upload'
import styles from '../Workspace.module.less'

const { Dragger } = Upload
const { Title, Paragraph, Text } = Typography

interface UploadPanelProps {
  // 状态
  uploadImages: UploadImageItem[]
  isSelecting: boolean
  isSplitting: boolean
  splitProgress: { percent: number; status: string; taskId?: string; isFirstRun?: boolean }
  isErasing: boolean
  isCreating: boolean
  
  // 事件处理
  onSelectImages: () => void
  onRemoveImage: (id: string) => void
  onPreviewImage: (img: UploadImageItem) => void
  onAutoSplit: (id: string) => void
  onSplitAll: () => void
  onEraseHandwriting: (id: string) => void
  onEraseAll: () => void
  onCorrectAll: () => void
  onCancelTask: (taskId?: string) => void
  onCancelUpload: () => void
  onShowTitleModal: () => void
  onUploadPropsBeforeUpload: (file: File) => boolean
}

export const UploadPanel: React.FC<UploadPanelProps> = ({
  uploadImages,
  isSelecting,
  isSplitting,
  splitProgress,
  isErasing,
  isCreating,
  onSelectImages,
  onRemoveImage,
  onPreviewImage,
  onAutoSplit,
  onSplitAll,
  onEraseHandwriting,
  onEraseAll,
  onCorrectAll,
  onCancelTask,
  onCancelUpload,
  onShowTitleModal,
  onUploadPropsBeforeUpload
}) => {
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: 'image/*',
    showUploadList: false,
    beforeUpload: (file) => onUploadPropsBeforeUpload(file)
  }

  return (
    <div className={styles.editorContainer}>
      <div className={styles.uploadPanel}>
        <div className={styles.uploadHeader}>
          <Title level={4} style={{ margin: 0, color: 'white' }}>上传试卷</Title>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={onCancelUpload}
            style={{ color: 'white' }}
          />
        </div>
        <Paragraph style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: 16 }}>
          选择试卷图片，系统将自动识别题目内容并生成课件
        </Paragraph>
        
        {uploadImages.length === 0 ? (
          <Dragger {...uploadProps} className={styles.uploadDragger}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 48 }} />
            </p>
            <p style={{ color: 'white' }}>点击或拖拽文件到此区域上传</p>
            <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>支持单个或批量上传试卷图片</p>
          </Dragger>
        ) : (
          <div className={styles.uploadImageList}>
            {uploadImages.map((img, index) => (
              <div key={img.id} className={styles.uploadImageItem}>
                <div className={styles.imageIndex}>{index + 1}</div>
                <div className={styles.imageThumbnail}>
                  {img.thumbnail ? (
                    <img src={img.thumbnail} alt={img.name} />
                  ) : (
                    <Spin size="small" />
                  )}
                </div>
                <div className={styles.imageInfo}>
                  <Text ellipsis className={styles.imageName} style={{ color: 'white' }}>{img.name}</Text>
                  {img.isProcessing && (
                    <Progress percent={img.ocrProgress || 0} size="small" />
                  )}
                  {img.ocrText && (
                    <Text type="secondary" ellipsis style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {img.ocrText.substring(0, 50)}...
                    </Text>
                  )}
                </div>
                <div className={styles.imageActions}>
                  <Button
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={() => onPreviewImage(img)}
                    style={{ color: 'white' }}
                  />
                  <Button
                    type="text"
                    icon={<ScanOutlined />}
                    onClick={() => onAutoSplit(img.id)}
                    loading={isSplitting}
                    style={{ color: 'white' }}
                    title="自动切题"
                  />
                  <Button
                    type="text"
                    icon={<ClearOutlined />}
                    onClick={() => onEraseHandwriting(img.id)}
                    loading={isErasing}
                    style={{ color: 'white' }}
                    title="擦除笔迹"
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onRemoveImage(img.id)}
                    title="删除"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        
        {isSplitting && (
          <Alert
            type="info"
            message={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>正在自动切题</span>
                <Button
                  type="link"
                  danger
                  icon={<StopOutlined />}
                  onClick={() => onCancelTask(splitProgress.taskId)}
                  style={{ padding: 0 }}
                >
                  取消
                </Button>
              </div>
            }
            description={
              <div>
                <Progress percent={splitProgress.percent} size="small" />
                <div style={{ marginTop: 4 }}>{splitProgress.status}</div>
                {splitProgress.isFirstRun && (
                  <div style={{ marginTop: 8, color: '#faad14', fontSize: 12 }}>
                    💡 温馨提示：首次识别需要加载OCR模型，通常需要30-60秒，请耐心等待。
                  </div>
                )}
              </div>
            }
            style={{ marginTop: 16 }}
          />
        )}
        
        <div className={styles.uploadActions}>
          <Button
            icon={<PlusOutlined />}
            onClick={onSelectImages}
            loading={isSelecting}
            className={styles.toolBtn}
          >
            添加图片
          </Button>
          <Button
            icon={<ScanOutlined />}
            onClick={onSplitAll}
            disabled={uploadImages.length === 0}
            loading={isSplitting}
            className={styles.toolBtn}
            title="将所有图片智能切分为单道题目"
          >
            批量切题
          </Button>
          <Button
            icon={<RotateRightOutlined />}
            onClick={onCorrectAll}
            disabled={uploadImages.length === 0}
            className={styles.toolBtn}
            title="自动矫正所有图片的倾斜和白边"
          >
            批量矫正
          </Button>
          <Button
            icon={<ClearOutlined />}
            onClick={onEraseAll}
            disabled={uploadImages.length === 0}
            loading={isErasing}
            className={styles.toolBtn}
            title="擦除所有图片的手写笔迹"
          >
            批量擦除
          </Button>
          <Button
            type="primary"
            icon={<FileAddOutlined />}
            onClick={onShowTitleModal}
            disabled={uploadImages.length === 0}
            loading={isCreating}
            className={styles.primaryBtn}
          >
            创建课件
          </Button>
        </div>
      </div>
    </div>
  )
}
