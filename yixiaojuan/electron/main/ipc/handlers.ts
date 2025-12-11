/**
 * IPC 处理器注册
 * 统一管理主进程与渲染进程之间的通信
 * 
 * 注意：此文件已重构，所有处理器已拆分到 handlers/ 目录下
 * 此文件保留作为向后兼容的入口点
 * 
 * 拆分后的模块结构：
 * - handlers/app-handlers.ts     - 应用、系统、激活相关
 * - handlers/window-handlers.ts  - 窗口控制相关
 * - handlers/file-handlers.ts    - 文件、图片处理相关
 * - handlers/courseware-handlers.ts - 课件相关
 * - handlers/question-handlers.ts   - 题目相关
 * - handlers/ocr-handlers.ts       - OCR相关（Tesseract.js + PaddleOCR）
 * - handlers/sync-handlers.ts      - 同步相关
 * - handlers/export-handlers.ts    - 导入导出、屏幕录制相关
 */

// 从新的模块化结构导入并导出
export { registerIPCHandlers } from './handlers/index'
