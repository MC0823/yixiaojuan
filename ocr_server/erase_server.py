"""
轻量级图片处理服务
包含：笔迹擦除、图片矫正、自动裁剪
只依赖 OpenCV 和 FastAPI，无需 PaddleOCR
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import base64
import io
import numpy as np
import cv2
from PIL import Image
from typing import Tuple, List, Optional

app = FastAPI(
    title="易小卷 图片处理服务",
    description="基于OpenCV的轻量级图片处理服务（笔迹擦除、图片矫正）",
    version="2.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def encode_image_to_base64(img_array: np.ndarray) -> str:
    """将numpy数组编码为base64字符串"""
    # 确保是RGB格式
    if len(img_array.shape) == 2:
        img_array = cv2.cvtColor(img_array, cv2.COLOR_GRAY2RGB)
    elif img_array.shape[2] == 4:
        img_array = cv2.cvtColor(img_array, cv2.COLOR_RGBA2RGB)
    
    image = Image.fromarray(img_array)
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    buffer.seek(0)
    return 'data:image/png;base64,' + base64.b64encode(buffer.read()).decode('utf-8')


def erase_handwriting_process(img_array: np.ndarray, mode: str = 'auto') -> np.ndarray:
    """
    擦除手写笔迹，还原空白试卷
    
    Args:
        img_array: 输入图片numpy数组 (RGB格式)
        mode: 擦除模式
            - 'auto': 自动检测并擦除所有手写内容
            - 'blue': 只擦除蓝色笔迹
            - 'black': 只擦除黑色手写（保留印刷体）
            - 'color': 擦除所有彩色笔迹（红、蓝、绿等）
    
    Returns:
        处理后的图片numpy数组
    """
    # 转换为BGR格式（OpenCV格式）
    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    result = img_bgr.copy()
    
    # 转换为HSV色彩空间
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    
    # 创建掩码
    mask = np.zeros(img_bgr.shape[:2], dtype=np.uint8)
    
    if mode == 'blue' or mode == 'auto' or mode == 'color':
        # 蓝色笔迹范围 (HSV)
        blue_lower = np.array([90, 50, 50])
        blue_upper = np.array([130, 255, 255])
        blue_mask = cv2.inRange(hsv, blue_lower, blue_upper)
        mask = cv2.bitwise_or(mask, blue_mask)
    
    if mode == 'color' or mode == 'auto':
        # 红色笔迹范围 (HSV) - 红色在HSV中分两段
        red_lower1 = np.array([0, 50, 50])
        red_upper1 = np.array([10, 255, 255])
        red_lower2 = np.array([170, 50, 50])
        red_upper2 = np.array([180, 255, 255])
        red_mask1 = cv2.inRange(hsv, red_lower1, red_upper1)
        red_mask2 = cv2.inRange(hsv, red_lower2, red_upper2)
        mask = cv2.bitwise_or(mask, red_mask1)
        mask = cv2.bitwise_or(mask, red_mask2)
        
        # 绿色笔迹范围
        green_lower = np.array([35, 50, 50])
        green_upper = np.array([85, 255, 255])
        green_mask = cv2.inRange(hsv, green_lower, green_upper)
        mask = cv2.bitwise_or(mask, green_mask)
    
    if mode == 'black' or mode == 'auto':
        # 黑色/深灰色手写检测 - 基于笔画特征
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        
        # 自适应阈值检测深色区域
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 15, 8
        )
        
        # 通过形态学操作区分印刷体和手写
        kernel_small = np.ones((2, 2), np.uint8)
        kernel_medium = np.ones((3, 3), np.uint8)
        
        dilated = cv2.dilate(binary, kernel_small, iterations=1)
        eroded = cv2.erode(dilated, kernel_medium, iterations=1)
        
        if mode == 'black':
            mask = cv2.bitwise_or(mask, eroded)
    
    # 膨胀掩码以确保完全覆盖笔迹
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=2)
    
    # 使用白色填充检测到的区域
    result[mask > 0] = [255, 255, 255]
    
    # 如果是auto模式，进行额外的平滑处理
    if mode == 'auto':
        blur_mask = cv2.dilate(mask, kernel, iterations=1)
        blurred = cv2.GaussianBlur(result, (3, 3), 0)
        result = np.where(blur_mask[:, :, np.newaxis] > 0, blurred, result)
    
    # 转回RGB格式
    result_rgb = cv2.cvtColor(result, cv2.COLOR_BGR2RGB)
    
    return result_rgb


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "service": "erase-handwriting"}


@app.post("/erase-handwriting")
async def erase_handwriting(data: dict):
    """
    擦除手写笔迹接口
    """
    try:
        image_data = data.get("image")
        if not image_data:
            raise HTTPException(status_code=400, detail="缺少image参数")
        
        mode = data.get("mode", "auto")
        if mode not in ['auto', 'blue', 'black', 'color']:
            mode = 'auto'
        
        print(f"[Erase] 开始擦除笔迹，模式: {mode}")
        
        # 解码图片
        if ',' in image_data:
            image_data_clean = image_data.split(',')[1]
        else:
            image_data_clean = image_data
        
        image_bytes = base64.b64decode(image_data_clean)
        image = Image.open(io.BytesIO(image_bytes))
        
        if image.mode == 'RGBA':
            image = image.convert('RGB')
        
        img_array = np.array(image)
        print(f"[Erase] 图片尺寸: {img_array.shape}")
        
        # 执行笔迹擦除
        result_array = erase_handwriting_process(img_array, mode)
        
        # 编码结果
        result_base64 = encode_image_to_base64(result_array)
        
        print(f"[Erase] 擦除完成")
        
        return {
            "success": True,
            "image": result_base64,
            "mode": mode
        }
        
    except Exception as e:
        print(f"[Erase] 错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def order_points(pts: np.ndarray) -> np.ndarray:
    """
    对四个角点按照左上、右上、右下、左下的顺序排列
    """
    rect = np.zeros((4, 2), dtype="float32")
    
    # 左上角的点x+y最小，右下角的点x+y最大
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    
    # 右上角的点x-y最大，左下角的点x-y最小
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    
    return rect


def find_document_contour(img_gray: np.ndarray) -> Optional[np.ndarray]:
    """
    查找文档轮廓（试卷边缘）
    返回四个角点或None
    """
    # 高斯模糊降噪
    blurred = cv2.GaussianBlur(img_gray, (5, 5), 0)
    
    # 边缘检测
    edges = cv2.Canny(blurred, 50, 150)
    
    # 膨胀边缘使其更连续
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=2)
    
    # 查找轮廓
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return None
    
    # 按面积排序，取最大的轮廓
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    
    for contour in contours[:5]:  # 检查前5个最大的轮廓
        # 计算轮廓周长
        peri = cv2.arcLength(contour, True)
        # 多边形近似
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        
        # 如果是四边形
        if len(approx) == 4:
            # 检查面积是否足够大（至少占图片的10%）
            img_area = img_gray.shape[0] * img_gray.shape[1]
            contour_area = cv2.contourArea(approx)
            if contour_area > img_area * 0.1:
                return approx.reshape(4, 2)
    
    return None


def perspective_transform(img: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """
    透视变换，将倾斜的文档矫正为正视图
    """
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    
    # 计算新图片的宽度
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    
    # 计算新图片的高度
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    
    # 目标点
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")
    
    # 计算透视变换矩阵
    M = cv2.getPerspectiveTransform(rect, dst)
    
    # 执行透视变换
    warped = cv2.warpPerspective(img, M, (maxWidth, maxHeight))
    
    return warped


def auto_crop_whitespace(img: np.ndarray, padding: int = 10) -> np.ndarray:
    """
    自动裁剪白边
    """
    # 转为灰度
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()
    
    # 二值化（反转，使内容为白色）
    _, binary = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
    
    # 查找非零区域
    coords = cv2.findNonZero(binary)
    
    if coords is None:
        return img
    
    # 获取边界框
    x, y, w, h = cv2.boundingRect(coords)
    
    # 添加padding
    x = max(0, x - padding)
    y = max(0, y - padding)
    w = min(img.shape[1] - x, w + 2 * padding)
    h = min(img.shape[0] - y, h + 2 * padding)
    
    # 裁剪
    cropped = img[y:y+h, x:x+w]
    
    return cropped


def detect_and_correct_rotation(img: np.ndarray) -> Tuple[np.ndarray, float]:
    """
    检测并修正图片旋转角度
    返回矫正后的图片和旋转角度
    """
    # 转为灰度
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()
    
    # 边缘检测
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    
    # 霍夫直线检测
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, 100, minLineLength=100, maxLineGap=10)
    
    if lines is None:
        return img, 0.0
    
    # 计算所有直线的角度
    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        # 只考虑接近水平或垂直的线
        if abs(angle) < 45:
            angles.append(angle)
        elif abs(angle) > 45 and abs(angle) < 135:
            angles.append(angle - 90 if angle > 0 else angle + 90)
    
    if not angles:
        return img, 0.0
    
    # 计算中位数角度（更稳定）
    median_angle = np.median(angles)
    
    # 如果角度很小，不需要矫正
    if abs(median_angle) < 0.5:
        return img, 0.0
    
    # 限制旋转角度范围
    if abs(median_angle) > 15:
        median_angle = 15 if median_angle > 0 else -15
    
    # 旋转图片
    h, w = img.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    
    # 计算新的边界
    cos = np.abs(M[0, 0])
    sin = np.abs(M[0, 1])
    new_w = int((h * sin) + (w * cos))
    new_h = int((h * cos) + (w * sin))
    
    M[0, 2] += (new_w / 2) - center[0]
    M[1, 2] += (new_h / 2) - center[1]
    
    rotated = cv2.warpAffine(img, M, (new_w, new_h), 
                             borderMode=cv2.BORDER_CONSTANT, 
                             borderValue=(255, 255, 255))
    
    return rotated, median_angle


def correct_image(img_array: np.ndarray, auto_perspective: bool = True, 
                  auto_rotate: bool = True, auto_crop: bool = True) -> dict:
    """
    综合图片矫正功能
    
    Args:
        img_array: RGB格式的图片数组
        auto_perspective: 是否自动透视矫正
        auto_rotate: 是否自动旋转矫正
        auto_crop: 是否自动裁剪白边
    
    Returns:
        包含矫正结果的字典
    """
    result = {
        "corrected": False,
        "perspective_applied": False,
        "rotation_angle": 0.0,
        "cropped": False
    }
    
    # 转为BGR格式（OpenCV格式）
    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    processed = img_bgr.copy()
    
    # 1. 透视矫正
    if auto_perspective:
        gray = cv2.cvtColor(processed, cv2.COLOR_BGR2GRAY)
        contour = find_document_contour(gray)
        
        if contour is not None:
            processed = perspective_transform(processed, contour)
            result["perspective_applied"] = True
            result["corrected"] = True
    
    # 2. 旋转矫正
    if auto_rotate:
        processed, angle = detect_and_correct_rotation(processed)
        if abs(angle) > 0.5:
            result["rotation_angle"] = round(angle, 2)
            result["corrected"] = True
    
    # 3. 自动裁剪白边
    if auto_crop:
        original_size = processed.shape[:2]
        processed = auto_crop_whitespace(processed)
        if processed.shape[:2] != original_size:
            result["cropped"] = True
            result["corrected"] = True
    
    # 转回RGB格式
    result_rgb = cv2.cvtColor(processed, cv2.COLOR_BGR2RGB)
    result["image"] = result_rgb
    
    return result


@app.post("/correct-image")
async def correct_image_api(data: dict):
    """
    图片自动矫正接口
    
    请求参数:
        - image: base64编码的图片
        - auto_perspective: 是否自动透视矫正（默认true）
        - auto_rotate: 是否自动旋转矫正（默认true）
        - auto_crop: 是否自动裁剪白边（默认true）
    
    返回:
        - success: 是否成功
        - image: 矫正后的base64图片
        - corrected: 是否进行了矫正
        - details: 矫正详情
    """
    try:
        image_data = data.get("image")
        if not image_data:
            raise HTTPException(status_code=400, detail="缺少image参数")
        
        auto_perspective = data.get("auto_perspective", True)
        auto_rotate = data.get("auto_rotate", True)
        auto_crop = data.get("auto_crop", True)
        
        print(f"[Correct] 开始图片矫正 perspective={auto_perspective}, rotate={auto_rotate}, crop={auto_crop}")
        
        # 解码图片
        if ',' in image_data:
            image_data_clean = image_data.split(',')[1]
        else:
            image_data_clean = image_data
        
        image_bytes = base64.b64decode(image_data_clean)
        image = Image.open(io.BytesIO(image_bytes))
        
        if image.mode == 'RGBA':
            image = image.convert('RGB')
        
        img_array = np.array(image)
        print(f"[Correct] 原始图片尺寸: {img_array.shape}")
        
        # 执行矫正
        result = correct_image(img_array, auto_perspective, auto_rotate, auto_crop)
        
        # 编码结果
        result_base64 = encode_image_to_base64(result["image"])
        
        print(f"[Correct] 矫正完成: corrected={result['corrected']}, rotation={result['rotation_angle']}")
        
        return {
            "success": True,
            "image": result_base64,
            "corrected": result["corrected"],
            "details": {
                "perspective_applied": result["perspective_applied"],
                "rotation_angle": result["rotation_angle"],
                "cropped": result["cropped"]
            }
        }
        
    except Exception as e:
        print(f"[Correct] 错误: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    print("正在启动图片处理服务...")
    print("服务地址: http://localhost:8089")
    print("支持功能: 笔迹擦除 /erase-handwriting, 图片矫正 /correct-image")
    uvicorn.run(app, host="0.0.0.0", port=8089)
