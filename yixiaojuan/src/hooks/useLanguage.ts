/**
 * 国际化语言管理 Hook
 * 支持中英文切换
 */
import { useCallback, useMemo } from 'react'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { useAppStore } from '../stores'

export type Language = 'zh-CN' | 'en-US'

// 语言包定义
const translations = {
  'zh-CN': {
    // 通用
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    delete: '删除',
    edit: '编辑',
    export: '导出',
    import: '导入',
    loading: '加载中...',
    success: '成功',
    failed: '失败',
    
    // 工作区
    myCourseware: '我的课件',
    newCourseware: '新建课件',
    questionList: '题目列表',
    questionDetail: '题目详情',
    uploadExam: '上传试卷',
    addImage: '添加图片',
    batchOcr: '批量OCR识别',
    createCourseware: '创建课件',
    undo: '撤销',
    redo: '重做',
    present: '演示',
    
    // 设置
    settings: '设置',
    basicSettings: '基本设置',
    activation: '软件激活',
    cloudSync: '云端同步',
    about: '关于',
    autoSave: '自动保存',
    autoSaveDesc: '编辑时自动保存课件内容',
    language: '界面语言',
    theme: '主题模式',
    lightTheme: '浅色模式',
    darkTheme: '深色模式',
    systemTheme: '跟随系统',
    
    // 激活
    activated: '已激活',
    notActivated: '未激活',
    enterActivationCode: '请输入激活码以解锁全部功能',
    activate: '激活',
    deviceIdAuto: '设备ID将自动绑定，无需手动操作',
    
    // 同步
    syncDesc: '开启后可将课件数据同步到云端，实现多设备访问和数据备份。',
    enableSync: '启用云端同步',
    syncNow: '立即同步',
    
    // 题目
    noQuestions: '暂无题目',
    noCourseware: '暂无课件',
    selectOrCreate: '选择或新建课件',
    selectFromLeft: '从左侧选择课件开始编辑'
  },
  'en-US': {
    // Common
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    export: 'Export',
    import: 'Import',
    loading: 'Loading...',
    success: 'Success',
    failed: 'Failed',
    
    // Workspace
    myCourseware: 'My Courseware',
    newCourseware: 'New Courseware',
    questionList: 'Questions',
    questionDetail: 'Question Detail',
    uploadExam: 'Upload Exam',
    addImage: 'Add Image',
    batchOcr: 'Batch OCR',
    createCourseware: 'Create',
    undo: 'Undo',
    redo: 'Redo',
    present: 'Present',
    
    // Settings
    settings: 'Settings',
    basicSettings: 'General',
    activation: 'Activation',
    cloudSync: 'Cloud Sync',
    about: 'About',
    autoSave: 'Auto Save',
    autoSaveDesc: 'Automatically save courseware when editing',
    language: 'Language',
    theme: 'Theme',
    lightTheme: 'Light',
    darkTheme: 'Dark',
    systemTheme: 'System',
    
    // Activation
    activated: 'Activated',
    notActivated: 'Not Activated',
    enterActivationCode: 'Enter activation code to unlock all features',
    activate: 'Activate',
    deviceIdAuto: 'Device ID will be bound automatically',
    
    // Sync
    syncDesc: 'Enable to sync courseware data to cloud for multi-device access and backup.',
    enableSync: 'Enable Cloud Sync',
    syncNow: 'Sync Now',
    
    // Questions
    noQuestions: 'No Questions',
    noCourseware: 'No Courseware',
    selectOrCreate: 'Select or Create Courseware',
    selectFromLeft: 'Select courseware from left to start editing'
  }
}

export function useLanguage() {
  const { settings, updateSettings } = useAppStore()
  
  // 获取翻译文本
  const t = useCallback((key: keyof typeof translations['zh-CN']): string => {
    return translations[settings.language]?.[key] || translations['zh-CN'][key] || key
  }, [settings.language])
  
  // 设置语言
  const setLanguage = useCallback((lang: Language) => {
    updateSettings({ language: lang })
  }, [updateSettings])
  
  // 获取 antd locale
  const antdLocale = useMemo(() => {
    return settings.language === 'en-US' ? enUS : zhCN
  }, [settings.language])
  
  return {
    language: settings.language,
    setLanguage,
    t,
    antdLocale
  }
}

export type TranslationKey = keyof typeof translations['zh-CN']
