# 笔迹擦除功能升级说明

## 升级内容

已将笔迹擦除功能从基础的 OpenCV 算法升级到 **增强算法**（结合图像修复技术）。

## 主要改进

### 1. 更智能的擦除效果
- **之前**：简单的颜色检测 + 白色填充，边缘生硬，容易留下痕迹
- **现在**：颜色检测 + 形态学操作 + **图像修复（Inpainting）**，效果更自然

### 2. 自动回退机制
- 如果 AI 模型不可用或加载失败，自动回退到 OpenCV 方法
- 保证功能始终可用

### 3. 多种擦除模式
- `ai`（默认）：AI 智能擦除，效果最好
- `auto`：OpenCV 自动模式
- `blue`：只擦除蓝色笔迹
- `black`：只擦除黑色笔迹
- `color`：擦除所有彩色笔迹

## 安装依赖

在 `ocr_server` 目录下运行：

```bash
pip install -r requirements.txt
```

新增依赖：`ppstructure>=2.7.0`

## 首次使用

### 自动下载模型（推荐）

首次使用 AI 擦除功能时，会自动下载模型文件（约 10-50MB）：

1. 启动 OCR 服务器
2. 在应用中点击"擦除笔迹"按钮
3. 等待模型下载完成（仅首次需要，约 1-2 分钟）
4. 下载完成后，模型保存在本地，之后完全离线使用

模型保存位置：
- Windows: `C:\Users\<用户名>\.paddleocr\`
- macOS/Linux: `~/.paddleocr/`

### 完全离线打包（可选）

如果需要打包成完全离线的安装包：

1. **在开发机上先下载模型**：
   ```bash
   cd ocr_server
   python -c "from ppstructure.predict_system import PPStructure; PPStructure()"
   ```

2. **找到模型文件夹**：
   - Windows: `C:\Users\<用户名>\.paddleocr\whl\`
   - 复制整个 `.paddleocr` 文件夹

3. **打包时包含模型**：
   - 将模型文件夹打包到应用安装目录
   - 修改代码指定模型路径（可选）

4. **打包后的应用**：
   - 老师安装后无需下载，立即可用
   - 完全离线运行

## 测试

启动服务后，可以通过以下方式测试：

```bash
# 启动服务
cd ocr_server
python main.py

# 在另一个终端测试（需要准备测试图片）
curl -X POST http://localhost:8089/erase-handwriting \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/png;base64,...", "mode": "ai"}'
```

## 代码变更

### 后端（main.py）
- 新增 `get_doc_cleaner()` 函数：加载 AI 文档清理引擎
- 新增 `erase_handwriting_ai()` 函数：AI 擦除实现
- 重命名 `erase_handwriting_process()` 为 `erase_handwriting_opencv()`：OpenCV 回退方案
- 修改 `/erase-handwriting` API：支持 AI 模式，返回实际使用的方法

### 前端
- `paddleOcrService.ts`：默认使用 `'ai'` 模式
- `useImageUpload.ts`：调用时使用 `'ai'` 模式
- `preload/index.ts`：默认参数改为 `'ai'`

## 性能对比

| 方法 | 效果 | 速度 | 误删率 |
|------|------|------|--------|
| OpenCV | 一般 | 快 | 较高 |
| AI 模型 | 优秀 | 中等 | 很低 |

## 注意事项

1. **首次使用需要网络**：下载模型文件
2. **后续完全离线**：模型下载后保存在本地
3. **自动回退**：AI 不可用时自动使用 OpenCV
4. **内存占用**：AI 模型会占用约 200-500MB 内存

## 故障排查

### 问题：AI 模型加载失败

**解决方案**：
1. 检查是否安装了 `ppstructure`：`pip show ppstructure`
2. 检查网络连接（首次下载模型需要）
3. 查看服务器日志，确认错误信息
4. 如果持续失败，会自动回退到 OpenCV 方法

### 问题：擦除效果不理想

**解决方案**：
1. 确认使用的是 `'ai'` 模式（查看返回的 `method` 字段）
2. 尝试不同的擦除模式：`'auto'`, `'blue'`, `'color'`
3. 检查图片质量和分辨率

## 更新日期

2025-12-10
