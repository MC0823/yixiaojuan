/**
 * 录制功能 Hook
 * 处理屏幕录制、音频录制、视频导出等
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { App } from 'antd'

interface UseRecordingOptions {
  coursewareTitle?: string
}

interface UseRecordingReturn {
  // 状态
  isRecording: boolean
  recordingTime: number
  hasRecording: boolean
  
  // 方法
  startRecording: () => Promise<void>
  stopRecording: () => void
  toggleRecording: () => void
  handleExportVideo: () => Promise<void>
  handleExportAudio: () => Promise<void>
  formatRecordingTime: (seconds: number) => string
}

export function useRecording({ coursewareTitle }: UseRecordingOptions = {}): UseRecordingReturn {
  const { message } = App.useApp()
  
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [hasRecording, setHasRecording] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isRecordingRef = useRef(false)
  const trackEndedHandlerRef = useRef<(() => void) | null>(null)

  /**
   * 格式化录制时间
   */
  const formatRecordingTime = useCallback((seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  /**
   * 停止录制
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    // 停止所有轨道并移除事件监听器
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (videoTrack && trackEndedHandlerRef.current) {
        videoTrack.removeEventListener('ended', trackEndedHandlerRef.current)
        trackEndedHandlerRef.current = null
      }
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // 清除计时器
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    setIsRecording(false)
    isRecordingRef.current = false
  }, [])

  /**
   * 开始录制（应用窗口+音频）
   */
  const startRecording = useCallback(async () => {
    try {
      // 通过 Electron IPC 获取窗口源
      if (!window.electronAPI?.screen?.getSources) {
        message.info({ content: '录制功能仅在桌面应用中可用', duration: 2 })
        return
      }

      const sourcesResult = await window.electronAPI.screen.getSources()
      if (!sourcesResult.success || !sourcesResult.data || sourcesResult.data.length === 0) {
        message.info({ content: '获取屏幕源失败', duration: 2 })
        return
      }

      // 查找当前应用窗口（易小卷）- 优先匹配窗口类型
      type SourceItem = { id: string; name: string; type: 'window' | 'screen' }
      const sources = sourcesResult.data as SourceItem[]
      
      const appWindow = sources.find(s => 
        s.type === 'window' && (
          s.name.includes('易小卷') || 
          s.name.includes('课件') ||
          s.name.includes('试卷')
        )
      ) || sources.find(s => s.type === 'window') || sources[0]
      
      // 使用 Electron 的屏幕捕获 API
      const displayStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: appWindow.id,
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080
          }
        } as MediaTrackConstraints
      })

      // 尝试获取麦克风音频
      let audioStream: MediaStream | null = null
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        console.log('无法获取麦克风，将只录制视频')
      }

      // 合并音视频轨道
      const tracks = [...displayStream.getTracks()]
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => tracks.push(track))
      }

      const combinedStream = new MediaStream(tracks)
      streamRef.current = combinedStream

      // 创建 MediaRecorder
      const options = { mimeType: 'video/webm;codecs=vp9,opus' }
      const mediaRecorder = new MediaRecorder(combinedStream, options)
      mediaRecorderRef.current = mediaRecorder
      recordedChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        setHasRecording(true)
      }

      // 监听流结束 - 使用ref获取最新状态
      const videoTrack = displayStream.getVideoTracks()[0]
      if (videoTrack) {
        const handleTrackEnded = () => {
          if (isRecordingRef.current) {
            stopRecording()
          }
        }
        trackEndedHandlerRef.current = handleTrackEnded
        videoTrack.addEventListener('ended', handleTrackEnded)
      }

      mediaRecorder.start(1000) // 每秒收集一次数据
      setIsRecording(true)
      isRecordingRef.current = true
      setRecordingTime(0)

      // 开始计时
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('录制启动失败:', error)
      message.info({ content: '录制启动失败，请检查权限设置', duration: 2 })
    }
  }, [isRecording, stopRecording])

  /**
   * 切换录制状态
   */
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  /**
   * 导出视频 (MP4)
   */
  const handleExportVideo = useCallback(async () => {
    if (recordedChunksRef.current.length === 0) {
      message.info({ content: '没有可导出的录制内容', duration: 2 })
      return
    }

    try {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
      const arrayBuffer = await blob.arrayBuffer()
      const filename = `${coursewareTitle || '课件'}_录制_${new Date().toLocaleDateString().replace(/\//g, '-')}.mp4`
      
      // 使用 Electron API 保存文件
      if (window.electronAPI?.video?.saveMp4) {
        const result = await window.electronAPI.video.saveMp4(arrayBuffer, filename)
        if (result.success) {
          message.success({ content: '视频导出成功', duration: 2 })
        } else if (result.error !== '用户取消') {
          message.info({ content: result.error || '导出失败', duration: 2 })
        }
      } else {
        // 回退到浏览器下载
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        message.success({ content: '视频导出成功', duration: 2 })
      }
    } catch (error) {
      console.error('视频导出失败:', error)
      message.info({ content: '视频导出失败', duration: 2 })
    }
  }, [coursewareTitle])

  /**
   * 导出音频 (MP3)
   */
  const handleExportAudio = useCallback(async () => {
    if (recordedChunksRef.current.length === 0) {
      message.info({ content: '没有可导出的录制内容', duration: 2 })
      return
    }

    try {
      // 从视频中提取音频
      const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
      const arrayBuffer = await blob.arrayBuffer()
      const filename = `${coursewareTitle || '课件'}_录音_${new Date().toLocaleDateString().replace(/\//g, '-')}.mp3`
      
      // 使用 Electron API 保存文件
      if (window.electronAPI?.audio?.save) {
        const result = await window.electronAPI.audio.save(arrayBuffer, filename)
        if (result.success) {
          message.success({ content: '音频导出成功', duration: 2 })
        } else if (result.error !== '用户取消') {
          message.info({ content: result.error || '导出失败', duration: 2 })
        }
      } else {
        // 回退到浏览器下载
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        message.success({ content: '音频导出成功', duration: 2 })
      }
    } catch (error) {
      console.error('音频导出失败:', error)
      message.info({ content: '音频导出失败', duration: 2 })
    }
  }, [coursewareTitle])

  // 组件卸载时清理录制资源
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.ondataavailable = null
        mediaRecorderRef.current.onstop = null
        mediaRecorderRef.current.onerror = null
      }
    }
  }, [])

  return {
    isRecording,
    recordingTime,
    hasRecording,
    startRecording,
    stopRecording,
    toggleRecording,
    handleExportVideo,
    handleExportAudio,
    formatRecordingTime
  }
}
