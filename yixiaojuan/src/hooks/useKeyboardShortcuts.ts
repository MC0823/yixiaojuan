/**
 * 键盘快捷键Hook
 * 提供全局快捷键支持
 */
import { useEffect, useCallback, useRef } from 'react'

export interface ShortcutConfig {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  handler: (e: KeyboardEvent) => void
  /** 是否阻止默认行为 */
  preventDefault?: boolean
  /** 描述（用于帮助提示） */
  description?: string
}

export interface UseKeyboardShortcutsOptions {
  /** 是否启用 */
  enabled?: boolean
  /** 当焦点在输入框中时是否禁用 */
  disableInInput?: boolean
}

/**
 * 快捷键Hook
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, disableInInput = true } = options
  const shortcutsRef = useRef(shortcuts)
  
  // 保持shortcuts引用最新
  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 如果禁用在输入框中的快捷键
    if (disableInInput) {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // 允许 Esc 键在输入框中也生效
        if (e.key !== 'Escape') {
          return
        }
      }
    }

    for (const shortcut of shortcutsRef.current) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey)
      const altMatch = !!shortcut.alt === e.altKey
      const shiftMatch = !!shortcut.shift === e.shiftKey

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        if (shortcut.preventDefault !== false) {
          e.preventDefault()
        }
        shortcut.handler(e)
        break
      }
    }
  }, [disableInInput])

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, handleKeyDown])
}

/**
 * 常用快捷键定义
 */
export const COMMON_SHORTCUTS = {
  // 编辑操作
  UNDO: { key: 'z', ctrl: true, description: '撤销' },
  REDO: { key: 'y', ctrl: true, description: '重做' },
  REDO_ALT: { key: 'z', ctrl: true, shift: true, description: '重做' },
  SAVE: { key: 's', ctrl: true, description: '保存' },
  
  // 导航操作
  ESCAPE: { key: 'Escape', description: '退出/取消' },
  
  // 选择操作
  SELECT_ALL: { key: 'a', ctrl: true, description: '全选' },
  
  // 删除操作
  DELETE: { key: 'Delete', description: '删除' },
  BACKSPACE: { key: 'Backspace', description: '删除' },
  
  // 翻页操作
  PREV: { key: 'ArrowLeft', description: '上一个' },
  NEXT: { key: 'ArrowRight', description: '下一个' },
  
  // 缩放操作
  ZOOM_IN: { key: '+', ctrl: true, description: '放大' },
  ZOOM_OUT: { key: '-', ctrl: true, description: '缩小' },
  ZOOM_RESET: { key: '0', ctrl: true, description: '重置缩放' }
} as const

export default useKeyboardShortcuts
