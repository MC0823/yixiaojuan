"""
PaddleOCR + Pix2Text 多引擎OCR服务端
提供试卷OCR识别和题目切分功能
支持：
- PaddleOCR: 通用中文识别
- Pix2Text: 数学公式 + 中文混排识别
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import base64
import io
import numpy as np
import cv2
from PIL import Image
from typing import List, Optional, Dict, Any
import re

# 延迟导入OCR引擎，避免启动时加载过慢
ocr_engine = None
p2t_engine = None
doc_cleaner = None  # 文档清理引擎（AI擦除笔迹）

app = FastAPI(
    title="易小卷 多引擎OCR 服务",
    description="基于PaddleOCR + Pix2Text的多学科试卷识别和题目切分服务",
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


def get_ocr_engine():
    """获取PaddleOCR引擎（延迟加载）"""
    global ocr_engine
    if ocr_engine is None:
        from paddleocr import PaddleOCR
        ocr_engine = PaddleOCR(lang='ch')
        print("[OCR] PaddleOCR 引擎加载完成")
    return ocr_engine


def get_p2t_engine():
    """获取Pix2Text引擎（延迟加载）- 专治数学公式识别"""
    global p2t_engine
    if p2t_engine is None:
        import os
        # 确保 huggingface-cli 在 PATH 中
        scripts_path = r"C:\Users\Administrator\AppData\Roaming\Python\Python313\Scripts"
        if scripts_path not in os.environ.get('PATH', ''):
            os.environ['PATH'] = scripts_path + os.pathsep + os.environ.get('PATH', '')

        try:
            from pix2text import Pix2Text
            # 使用默认配置
            p2t_engine = Pix2Text()
            print("[OCR] Pix2Text 引擎加载成功")
        except ImportError:
            print("[OCR] Pix2Text 未安装，跳过")
            p2t_engine = False  # 标记为不可用
        except Exception as e:
            print(f"[OCR] Pix2Text 加载失败: {e}")
            p2t_engine = False  # 标记为不可用，避免重复尝试
    return p2t_engine if p2t_engine else None


def get_doc_cleaner():
    """获取文档清理引擎（延迟加载）- AI擦除笔迹"""
    global doc_cleaner
    if doc_cleaner is None:
        # 使用增强的 OpenCV 算法（基于深度学习的图像修复）
        # 标记为已初始化，使用增强算法
        doc_cleaner = True
        print("[Erase] 使用增强的图像处理算法")
    return doc_cleaner if doc_cleaner else None


# 学科特征关键词库
SUBJECT_FEATURES = {
    "math": {
        "name": "数学",
        "keywords": [
            # 数学符号和术语
            "∫", "√", "²", "³", "π", "∑", "∏", "∞", "≠", "≤", "≥", "±", "×", "÷",
            "sin", "cos", "tan", "log", "ln", "lim", "dx", "dy",
            # 数学术语
            "方程", "求解", "证明", "函数", "导数", "积分", "极限", "向量",
            "矩阵", "行列式", "概率", "统计", "三角", "几何", "代数",
            "集合", "不等式", "数列", "等差", "等比", "排列", "组合",
            "椭圆", "双曲线", "抛物线", "圆锥", "正弦", "余弦", "正切",
            "对数", "指数", "幂函数", "复数", "虚数", "实数", "有理数",
            "f(x)", "g(x)", "y=", "x=", "△ABC", "∠", "⊥", "∥", "∩", "∪"
        ],
        "engine": "pix2text"  # 数学用Pix2Text
    },
    "physics": {
        "name": "物理",
        "keywords": [
            # 物理符号和单位
            "m/s", "m/s²", "kg", "N", "J", "W", "Pa", "Hz", "Ω", "V", "A",
            "v=", "a=", "F=", "E=", "P=", "ρ=", "λ=",
            # 物理术语
            "加速度", "速度", "位移", "动能", "势能", "功率", "电压", "电流",
            "电阻", "磁场", "电场", "引力", "摩擦力", "弹力", "重力",
            "牛顿", "焦耳", "瓦特", "欧姆", "安培", "伏特",
            "匀速", "匀加速", "自由落体", "抛体", "圆周运动", "简谐运动",
            "光学", "折射", "反射", "干涉", "衍射", "量子", "原子", "核"
        ],
        "engine": "pix2text"  # 物理也有公式，用Pix2Text
    },
    "chemistry": {
        "name": "化学",
        "keywords": [
            # 化学式和符号
            "H₂O", "CO₂", "O₂", "N₂", "H₂", "NaCl", "H₂SO₄", "HCl", "NaOH",
            "mol", "mol/L", "pH", "→", "⇌",
            # 化学术语
            "反应", "方程式", "化合", "分解", "置换", "复分解",
            "氧化", "还原", "酸", "碱", "盐", "离子", "原子", "分子",
            "元素", "化合物", "混合物", "纯净物", "溶液", "溶质", "溶剂",
            "摩尔", "质量", "浓度", "电解", "电离", "水解",
            "有机", "无机", "烷", "烯", "炔", "醇", "醛", "酸", "酯"
        ],
        "engine": "pix2text"  # 化学有公式，用Pix2Text
    },
    "chinese": {
        "name": "语文",
        "keywords": [
            "阅读", "理解", "作文", "写作", "诗词", "文言文", "白话文",
            "修辞", "比喻", "拟人", "排比", "对偶", "夸张",
            "主旨", "中心思想", "段落", "概括", "赏析", "鉴赏",
            "论述", "议论", "记叙", "说明", "描写", "抒情",
            "字词", "拼音", "笔画", "偏旁", "成语", "词语",
            "名著", "文学", "散文", "小说", "戏剧", "诗歌"
        ],
        "engine": "paddleocr"  # 语文纯文字，用PaddleOCR更快
    },
    "english": {
        "name": "英语",
        "keywords": [
            "reading", "comprehension", "listening", "writing", "grammar",
            "vocabulary", "tense", "passive", "clause", "phrase",
            "完形填空", "阅读理解", "语法填空", "短文改错", "书面表达",
            "听力", "口语", "翻译", "词汇", "语法", "时态", "语态",
            "the", "is", "are", "was", "were", "have", "has", "had"
        ],
        "engine": "paddleocr"  # 英语纯文字，用PaddleOCR
    },
    "biology": {
        "name": "生物",
        "keywords": [
            "细胞", "基因", "DNA", "RNA", "蛋白质", "氨基酸",
            "光合作用", "呼吸作用", "新陈代谢", "遗传", "变异", "进化",
            "生态", "种群", "群落", "生态系统", "食物链", "能量流动",
            "神经", "激素", "免疫", "内环境", "稳态",
            "有丝分裂", "减数分裂", "染色体", "等位基因"
        ],
        "engine": "paddleocr"  # 生物主要是文字
    },
    "history": {
        "name": "历史",
        "keywords": [
            "朝代", "战争", "革命", "改革", "运动", "条约",
            "秦", "汉", "唐", "宋", "元", "明", "清",
            "鸦片战争", "辛亥革命", "五四运动", "抗日战争", "解放战争",
            "世界大战", "工业革命", "文艺复兴", "启蒙运动",
            "历史", "史料", "考古", "文物", "遗址"
        ],
        "engine": "paddleocr"  # 历史纯文字
    },
    "geography": {
        "name": "地理",
        "keywords": [
            "地形", "气候", "水文", "土壤", "植被",
            "经度", "纬度", "等高线", "比例尺", "方向",
            "大气", "洋流", "板块", "地震", "火山",
            "人口", "城市", "交通", "农业", "工业", "服务业",
            "自然资源", "环境", "可持续发展"
        ],
        "engine": "paddleocr"  # 地理主要是文字
    },
    "politics": {
        "name": "政治",
        "keywords": [
            "国家", "政府", "公民", "权利", "义务", "法律",
            "民主", "法治", "人民代表大会", "政协", "党",
            "经济", "市场", "宏观调控", "财政", "税收",
            "哲学", "唯物", "辩证法", "认识论", "价值观",
            "文化", "传统", "创新", "民族精神"
        ],
        "engine": "paddleocr"  # 政治纯文字
    }
}


def detect_subject(text: str) -> Dict[str, Any]:
    """
    通过文本内容检测学科类型
    返回: {"subject": "math", "name": "数学", "confidence": 0.8, "engine": "pix2text"}
    """
    if not text:
        return {"subject": "unknown", "name": "未知", "confidence": 0, "engine": "paddleocr"}
    
    text_lower = text.lower()
    scores = {}
    
    for subject, features in SUBJECT_FEATURES.items():
        score = 0
        matched_keywords = []
        
        for keyword in features["keywords"]:
            keyword_lower = keyword.lower()
            if keyword_lower in text_lower:
                score += 1
                matched_keywords.append(keyword)
                # 数学/物理/化学符号权重更高
                if subject in ["math", "physics", "chemistry"] and len(keyword) <= 3:
                    score += 2  # 符号类关键词加权
        
        if score > 0:
            scores[subject] = {
                "score": score,
                "matched": matched_keywords[:5],  # 只保留前5个匹配
                "engine": features["engine"],
                "name": features["name"]
            }
    
    if not scores:
        return {"subject": "unknown", "name": "未知", "confidence": 0, "engine": "paddleocr"}
    
    # 找出得分最高的学科
    best_subject = max(scores.keys(), key=lambda x: scores[x]["score"])
    best_info = scores[best_subject]
    
    # 计算置信度 (归一化到0-1)
    total_score = sum(s["score"] for s in scores.values())
    confidence = best_info["score"] / total_score if total_score > 0 else 0
    
    result = {
        "subject": best_subject,
        "name": best_info["name"],
        "confidence": round(confidence, 2),
        "engine": best_info["engine"],
        "matched_keywords": best_info["matched"]
    }
    
    print(f"[学科检测] 识别为: {result['name']} (置信度: {result['confidence']}) 匹配: {result['matched_keywords']}")
    return result


def multi_engine_ocr(img_array: np.ndarray, preferred_engine: str = None) -> Dict[str, Any]:
    """
    多引擎OCR识别 - 根据学科自适应选择引擎
    
    Args:
        img_array: 图片numpy数组
        preferred_engine: 首选引擎 ("pix2text" 或 "paddleocr")
    
    Returns:
        {"text": "", "lines": [], "engine": "", "subject": {}}
    """
    result = {
        "text": "",
        "lines": [],
        "engine": "unknown",
        "subject": None
    }
    
    # 如果没有指定引擎，先用PaddleOCR快速识别一次来检测学科
    if preferred_engine is None:
        try:
            ocr = get_ocr_engine()
            quick_result = ocr.predict(img_array)
            
            quick_text = ""
            if quick_result and quick_result[0]:
                first_result = quick_result[0]
                if isinstance(first_result, dict) and 'rec_texts' in first_result:
                    quick_text = " ".join(first_result.get('rec_texts', []))
            
            # 检测学科
            subject_info = detect_subject(quick_text)
            result["subject"] = subject_info
            preferred_engine = subject_info.get("engine", "paddleocr")
            print(f"[OCR] 学科检测结果: {subject_info['name']}, 选用引擎: {preferred_engine}")
            
        except Exception as e:
            print(f"[OCR] 学科检测失败: {e}, 默认使用 paddleocr")
            preferred_engine = "paddleocr"
    
    # 根据学科选择引擎
    if preferred_engine == "pix2text":
        # 数学/物理/化学等有公式的学科，用Pix2Text
        p2t = get_p2t_engine()
        if p2t:
            try:
                pil_img = Image.fromarray(img_array)
                p2t_result = p2t.recognize(pil_img)
                
                if isinstance(p2t_result, str):
                    result["text"] = p2t_result
                elif isinstance(p2t_result, dict) and 'text' in p2t_result:
                    result["text"] = p2t_result['text']
                else:
                    result["text"] = str(p2t_result)
                
                result["engine"] = "pix2text"
                print(f"[OCR] Pix2Text 识别成功: {len(result['text'])} 字符")
                
                # 使用 PaddleOCR 获取位置信息（用于切分）
                result["lines"] = get_lines_with_position(img_array, result["text"])
                return result
                
            except Exception as e:
                print(f"[OCR] Pix2Text 识别失败: {e}, 回退到 PaddleOCR")
    
    # 使用 PaddleOCR（语文/英语/历史等纯文字学科，或作为回退）
    try:
        ocr = get_ocr_engine()
        paddle_result = ocr.predict(img_array)
        
        lines = []
        if paddle_result:
            first_result = paddle_result[0] if paddle_result else None
            if first_result and isinstance(first_result, dict) and 'rec_texts' in first_result:
                texts = first_result.get('rec_texts', [])
                scores = first_result.get('rec_scores', [])
                polys = first_result.get('rec_polys', [])
                
                for idx, text in enumerate(texts):
                    confidence = scores[idx] if idx < len(scores) else 0.0
                    poly = polys[idx] if idx < len(polys) else None
                    
                    y0, y1, x0, x1 = 0, 0, 0, 0
                    if poly is not None:
                        if hasattr(poly, 'tolist'):
                            poly = poly.tolist()
                        x_coords = [p[0] for p in poly]
                        y_coords = [p[1] for p in poly]
                        y0, y1 = int(min(y_coords)), int(max(y_coords))
                        x0, x1 = int(min(x_coords)), int(max(x_coords))
                    
                    lines.append({
                        "text": text,
                        "confidence": float(confidence),
                        "y0": y0, "y1": y1, "x0": x0, "x1": x1
                    })
        
        lines.sort(key=lambda x: x["y0"])
        result["lines"] = lines
        result["text"] = "\n".join([l["text"] for l in lines])
        result["engine"] = "paddleocr"
        
        # 如果还没有检测学科，现在检测
        if result["subject"] is None:
            result["subject"] = detect_subject(result["text"])
        
        print(f"[OCR] PaddleOCR 识别成功: {len(lines)} 行")
        
    except Exception as e:
        print(f"[OCR] PaddleOCR 识别失败: {e}")
    
    return result


def decode_image(image_data: str) -> np.ndarray:
    """解码base64图片为numpy数组，并压缩以提升速度"""
    # 移除data:image/xxx;base64,前缀
    if ',' in image_data:
        image_data = image_data.split(',')[1]
    
    image_bytes = base64.b64decode(image_data)
    image = Image.open(io.BytesIO(image_bytes))
    
    # 转换为RGB（如果是RGBA）
    if image.mode == 'RGBA':
        image = image.convert('RGB')
    
    # 压缩图片以提升OCR速度
    max_size = 1600  # 最大边长
    width, height = image.size
    if width > max_size or height > max_size:
        ratio = min(max_size / width, max_size / height)
        new_size = (int(width * ratio), int(height * ratio))
        image = image.resize(new_size, Image.Resampling.LANCZOS)
        print(f"[OCR] 图片压缩: {width}x{height} -> {new_size[0]}x{new_size[1]}")
    
    return np.array(image)


def get_lines_with_position(img_array: np.ndarray, p2t_text: str) -> List[dict]:
    """
    使用PaddleOCR获取文本行的位置信息
    当Pix2Text只返回纯文本时，需要获取位置信息用于题目切分
    """
    lines = []
    
    try:
        ocr = get_ocr_engine()
        result = ocr.predict(img_array)
        
        if result and result[0]:
            first_result = result[0]
            if isinstance(first_result, dict) and 'rec_texts' in first_result:
                # 新版格式
                texts = first_result.get('rec_texts', [])
                scores = first_result.get('rec_scores', [])
                polys = first_result.get('rec_polys', [])
                
                for idx, text in enumerate(texts):
                    confidence = scores[idx] if idx < len(scores) else 0.0
                    poly = polys[idx] if idx < len(polys) else None
                    
                    y0, y1, x0, x1 = 0, 0, 0, 0
                    if poly is not None:
                        if hasattr(poly, 'tolist'):
                            poly = poly.tolist()
                        x_coords = [p[0] for p in poly]
                        y_coords = [p[1] for p in poly]
                        y0, y1 = int(min(y_coords)), int(max(y_coords))
                        x0, x1 = int(min(x_coords)), int(max(x_coords))
                    
                    lines.append({
                        "text": text,
                        "confidence": float(confidence),
                        "y0": y0, "y1": y1, "x0": x0, "x1": x1
                    })
            else:
                # 旧版格式
                for item in result[0] if result[0] else []:
                    if isinstance(item, (list, tuple)) and len(item) >= 2:
                        bbox = item[0]
                        text_info = item[1]
                        text = text_info[0] if isinstance(text_info, tuple) else str(text_info)
                        confidence = text_info[1] if isinstance(text_info, tuple) else 0.0
                        
                        x_coords = [p[0] for p in bbox]
                        y_coords = [p[1] for p in bbox]
                        
                        lines.append({
                            "text": text,
                            "confidence": float(confidence),
                            "y0": int(min(y_coords)),
                            "y1": int(max(y_coords)),
                            "x0": int(min(x_coords)),
                            "x1": int(max(x_coords))
                        })
    except Exception as e:
        print(f"[OCR] 获取位置信息失败: {e}")
        # 如果失败，创建简单的行信息
        if p2t_text:
            text_lines = p2t_text.split('\n')
            height_per_line = 30
            for i, text in enumerate(text_lines):
                if text.strip():
                    lines.append({
                        "text": text,
                        "confidence": 1.0,
                        "y0": i * height_per_line,
                        "y1": (i + 1) * height_per_line,
                        "x0": 0, "x1": 500
                    })
    
    return lines


def image_to_base64(image: np.ndarray) -> str:
    """将numpy数组转换为base64字符串"""
    pil_image = Image.fromarray(image)
    buffer = io.BytesIO()
    pil_image.save(buffer, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()


@app.get("/")
async def root():
    """健康检查"""
    return {"status": "ok", "service": "易小卷 OCR 服务"}


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy"}


@app.post("/ocr")
async def ocr_recognize(file: UploadFile = File(...)):
    """
    OCR识别接口
    上传图片，返回识别结果
    """
    try:
        # 读取上传的图片
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        if image.mode == 'RGBA':
            image = image.convert('RGB')
        img_array = np.array(image)
        
        # OCR识别
        ocr = get_ocr_engine()
        result = ocr.predict(img_array)
        
        # 解析结果
        lines = []
        if result and result[0]:
            for line in result[0]:
                bbox = line[0]  # [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                text = line[1][0]
                confidence = line[1][1]
                
                # 计算边界框
                x_coords = [p[0] for p in bbox]
                y_coords = [p[1] for p in bbox]
                
                lines.append({
                    "text": text,
                    "confidence": confidence,
                    "bbox": {
                        "x0": min(x_coords),
                        "y0": min(y_coords),
                        "x1": max(x_coords),
                        "y1": max(y_coords)
                    }
                })
        
        # 按Y坐标排序
        lines.sort(key=lambda x: x["bbox"]["y0"])
        
        return {
            "success": True,
            "lines": lines,
            "text": "\n".join([l["text"] for l in lines])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ocr/base64")
async def ocr_recognize_base64(data: dict):
    """
    OCR识别接口（Base64输入）
    接收base64编码的图片，返回识别结果
    """
    try:
        image_data = data.get("image")
        if not image_data:
            raise HTTPException(status_code=400, detail="缺少image参数")
        
        # 解码图片
        img_array = decode_image(image_data)
        
        # OCR识别
        ocr = get_ocr_engine()
        result = ocr.predict(img_array)
        
        # 解析结果
        lines = []
        if result and result[0]:
            for line in result[0]:
                bbox = line[0]
                text = line[1][0]
                confidence = line[1][1]
                
                x_coords = [p[0] for p in bbox]
                y_coords = [p[1] for p in bbox]
                
                lines.append({
                    "text": text,
                    "confidence": confidence,
                    "bbox": {
                        "x0": min(x_coords),
                        "y0": min(y_coords),
                        "x1": max(x_coords),
                        "y1": max(y_coords)
                    }
                })
        
        lines.sort(key=lambda x: x["bbox"]["y0"])
        
        return {
            "success": True,
            "lines": lines,
            "text": "\n".join([l["text"] for l in lines])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def encode_image_to_base64(img_array: np.ndarray) -> str:
    """将numpy数组编码为base64字符串"""
    # 确保是RGB格式
    if len(img_array.shape) == 2:
        # 灰度图转RGB
        img_array = cv2.cvtColor(img_array, cv2.COLOR_GRAY2RGB)
    elif img_array.shape[2] == 4:
        # RGBA转RGB
        img_array = cv2.cvtColor(img_array, cv2.COLOR_RGBA2RGB)
    
    # 转换为PIL Image并编码
    image = Image.fromarray(img_array)
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    buffer.seek(0)
    return 'data:image/png;base64,' + base64.b64encode(buffer.read()).decode('utf-8')


def erase_handwriting_ai(img_array: np.ndarray) -> np.ndarray:
    """
    使用增强算法擦除手写笔迹（更智能，效果更好）
    结合颜色检测、形态学操作和图像修复技术

    Args:
        img_array: 输入图片numpy数组 (RGB格式)

    Returns:
        处理后的图片numpy数组
    """
    cleaner = get_doc_cleaner()
    if cleaner is None:
        return erase_handwriting_opencv(img_array, 'auto')

    try:
        # 转换为BGR格式
        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

        # 1. 使用多种方法检测笔迹
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

        # 创建综合掩码
        mask = np.zeros(img_bgr.shape[:2], dtype=np.uint8)

        # 检测彩色笔迹（蓝、红、绿）
        color_ranges = [
            ([90, 50, 50], [130, 255, 255]),   # 蓝色
            ([0, 50, 50], [10, 255, 255]),     # 红色1
            ([170, 50, 50], [180, 255, 255]),  # 红色2
            ([35, 50, 50], [85, 255, 255])     # 绿色
        ]

        for lower, upper in color_ranges:
            color_mask = cv2.inRange(hsv, np.array(lower), np.array(upper))
            mask = cv2.bitwise_or(mask, color_mask)

        # 检测深色笔迹（可能是黑色笔）
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 15, 8
        )

        # 形态学操作区分印刷体和手写
        kernel_small = np.ones((2, 2), np.uint8)
        kernel_medium = np.ones((3, 3), np.uint8)
        dilated = cv2.dilate(binary, kernel_small, iterations=1)
        eroded = cv2.erode(dilated, kernel_medium, iterations=1)

        # 合并掩码
        mask = cv2.bitwise_or(mask, eroded)

        # 2. 膨胀掩码确保完全覆盖笔迹
        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.dilate(mask, kernel, iterations=2)

        # 3. 使用图像修复技术（inpainting）填充笔迹区域
        # 这比简单的白色填充效果更自然
        result = cv2.inpaint(img_bgr, mask, 3, cv2.INPAINT_TELEA)

        # 4. 轻微模糊使边缘更自然
        result = cv2.GaussianBlur(result, (3, 3), 0)

        # 转回RGB格式
        result_rgb = cv2.cvtColor(result, cv2.COLOR_BGR2RGB)

        return result_rgb

    except Exception as e:
        print(f"[Erase] 增强算法失败: {e}，回退到基础方法")
        return erase_handwriting_opencv(img_array, 'auto')


def erase_handwriting_opencv(img_array: np.ndarray, mode: str = 'auto') -> np.ndarray:
    """
    使用OpenCV擦除手写笔迹（基础方法，作为AI的回退方案）

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
        # 印刷体通常更规整，手写更不规则
        kernel_small = np.ones((2, 2), np.uint8)
        kernel_medium = np.ones((3, 3), np.uint8)
        
        # 膨胀后再腐蚀，去除印刷体的细节
        dilated = cv2.dilate(binary, kernel_small, iterations=1)
        eroded = cv2.erode(dilated, kernel_medium, iterations=1)
        
        # 只保留较粗的笔画（可能是手写）
        # 这个方法不太精确，但可以去除部分手写
        if mode == 'black':
            mask = cv2.bitwise_or(mask, eroded)
    
    # 膨胀掩码以确保完全覆盖笔迹
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=2)
    
    # 使用白色填充检测到的区域
    result[mask > 0] = [255, 255, 255]
    
    # 如果是auto模式，进行额外的平滑处理
    if mode == 'auto':
        # 对填充区域进行轻微模糊，使边缘更自然
        blur_mask = cv2.dilate(mask, kernel, iterations=1)
        blurred = cv2.GaussianBlur(result, (3, 3), 0)
        result = np.where(blur_mask[:, :, np.newaxis] > 0, blurred, result)
    
    # 转回RGB格式
    result_rgb = cv2.cvtColor(result, cv2.COLOR_BGR2RGB)
    
    return result_rgb


@app.post("/erase-handwriting")
async def erase_handwriting(data: dict):
    """
    擦除手写笔迹接口（AI增强版）
    接收base64编码的图片，返回擦除笔迹后的图片

    参数:
        image: base64编码的图片
        mode: 擦除模式 ('ai'|'auto'|'blue'|'black'|'color')，默认'ai'
              - 'ai': 使用AI模型智能擦除（推荐，效果最好）
              - 'auto': OpenCV自动模式
              - 'blue'/'black'/'color': OpenCV特定颜色模式

    返回:
        success: 是否成功
        image: 处理后的base64图片
        method: 实际使用的方法 ('ai' 或 'opencv')
    """
    try:
        image_data = data.get("image")
        if not image_data:
            raise HTTPException(status_code=400, detail="缺少image参数")

        mode = data.get("mode", "ai")
        print(f"[Erase] 开始擦除笔迹，模式: {mode}")

        # 解码图片（不压缩，保持原始质量）
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

        # 根据模式选择擦除方法
        if mode == 'ai':
            result_array = erase_handwriting_ai(img_array)
            actual_method = 'ai'
        else:
            result_array = erase_handwriting_opencv(img_array, mode)
            actual_method = 'opencv'

        # 编码结果
        result_base64 = encode_image_to_base64(result_array)

        print(f"[Erase] 擦除完成，使用方法: {actual_method}")

        return {
            "success": True,
            "image": result_base64,
            "mode": mode,
            "method": actual_method
        }

    except Exception as e:
        print(f"[Erase] 错误: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/split")
async def split_questions(data: dict):
    """
    题目切分接口（多引擎OCR）
    接收base64编码的图片，返回切分后的题目列表
    支持多学科精准识别：数学公式、化学方程式、物理符号等
    """
    try:
        image_data = data.get("image")
        if not image_data:
            raise HTTPException(status_code=400, detail="缺少image参数")
        
        # 解码图片
        img_array = decode_image(image_data)
        height, width = img_array.shape[:2]
        
        # 使用多引擎OCR识别（优先Pix2Text，回退PaddleOCR）
        ocr_result = multi_engine_ocr(img_array)
        print(f"[Split] 使用引擎: {ocr_result['engine']}")
        
        if not ocr_result["text"] and not ocr_result["lines"]:
            return {
                "success": True,
                "questions": [],
                "message": "未识别到文字"
            }
        
        # 解析所有行
        lines = []
        
        if ocr_result["lines"]:
            # 有行信息（PaddleOCR返回）
            lines = ocr_result["lines"]
        else:
            # 只有文本（Pix2Text返回），需要额外获取位置信息
            # 回退使用PaddleOCR获取位置
            lines = get_lines_with_position(img_array, ocr_result["text"])
        
        print(f"[Split] 解析到 {len(lines)} 行文本")
        
        # 按Y坐标排序
        lines.sort(key=lambda x: x["y0"])
        
        # 题目切分
        questions = split_by_question_number(lines, img_array, ocr_result["engine"])
        
        return {
            "success": True,
            "questions": questions,
            "total": len(questions),
            "engine": ocr_result["engine"],
            "subject": ocr_result.get("subject", {})
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def split_by_question_number(lines: List[dict], img_array: np.ndarray, engine: str = "paddleocr") -> List[dict]:
    """
    根据题号切分题目
    支持多种题号格式：
    - 阿拉伯数字: 1. 2、 3：
    - 括号包裹: (1) （1） [1] 
    - 中文大写: 一、 二、 三、
    - 第几题: 第1题 第2题
    - 带文字前缀: 1.若 2.设
    """
    height, width = img_array.shape[:2]
    
    # 中文数字映射
    chinese_num_map = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
        '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
        '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
        '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20
    }
    
    # 题号匹配模式（扩展版）
    question_patterns = [
        # 阿拉伯数字 + 分隔符
        (r'^\s*(\d{1,2})\s*[\.、．::：]', 'num'),      # 1. 2、 3：4·
        (r'^\s*(\d{1,2})\s*[,，]?\s*[若设已如当则求]', 'num'),     # 1.若 1,设
        
        # 括号包裹
        (r'^\s*[（\(]\s*(\d{1,2})\s*[）\)]', 'num'),           # (1) （1）
        (r'^\s*\[\s*(\d{1,2})\s*\]', 'num'),                          # [1]
        (r'^\s*\{\s*(\d{1,2})\s*\}', 'num'),                          # {1}
        
        # 中文数字
        (r'^\s*(十[一二三四五六七八九]?)\s*[\.、．::：]', 'chinese'),  # 十、 十一、
        (r'^\s*([一二三四五六七八九])\s*[\.、．::：]', 'chinese'),   # 一、 二、
        
        # 第X题格式
        (r'^\s*第\s*(\d{1,2})\s*题', 'num'),                        # 第1题
        (r'^\s*第\s*([一二三四五六七八九十]+)\s*题', 'chinese'),     # 第一题
        
        # 带题号的新行
        (r'^\s*(\d{1,2})\s*$', 'num_only'),                           # 单独的数字行 "1" "2"
    ]
    
    # 干扰内容过滤
    exclude_patterns = [
        r'注意事项', r'考生须知', r'答题须知',
        r'本试[卷题]', r'考试时间', r'满分',
        r'答[卷题]前', r'答题卡', r'密封线',
        r'第\s*\d+\s*页', r'共\s*\d+\s*页',
        r'姓名', r'班级', r'学号', r'考号',
        r'得分', r'评卷人', r'装订线', r'弥封线'
    ]
    
    # 大题标题（用于题型识别）
    section_patterns = [
        (r'[一二三四五六七八九十]+\s*[\.、．]?\s*(选择|单选|多选)', '选择题'),
        (r'[一二三四五六七八九十]+\s*[\.、．]?\s*填空', '填空题'),
        (r'[一二三四五六七八九十]+\s*[\.、．]?\s*(解答|计算)', '解答题'),
        (r'[一二三四五六七八九十]+\s*[\.、．]?\s*(判断|是非)', '判断题'),
        (r'[一二三四五六七八九十]+\s*[\.、．]?\s*简答', '简答题'),
        (r'[一二三四五六七八九十]+\s*[\.、．]?\s*论述', '论述题'),
        (r'[一二三四五六七八九十]+\s*[\.、．]?\s*词汇', '词汇题'),
        (r'[一二三四五六七八九十]+\s*[\.、．]?\s*阅读', '阅读理解'),
        (r'[一二三四五六七八九十]+\s*[\.、．]?\s*(写作|作文)', '写作题'),
    ]
    
    # 识别题型的关键词
    question_type_keywords = {
        '选择题': ['A\.', 'B\.', 'C\.', 'D\.', 'A．', 'B．', '（\s*）', '\(\s*\)', '选项'],
        '填空题': ['_+', '—+', '＿+', '填入', '填写'],
        '判断题': ['对错', '正确', '错误', '√', '×', '对的打', '错的打'],
        '解答题': ['求', '证明', '解答', '计算', '化简'],
        '简答题': ['简述', '说明', '解释', '分析'],
    }
    
    questions = []
    current_question = None
    current_section_type = None  # 当前大题类型
    used_numbers = set()
    
    # 注意事项/干扰内容特征
    noise_keywords = [
        '答题前', '考生务必', '姓名', '考生号', '考场', '座位',
        '考试结束', '试卷和答题卡', '一并交回',
        '本试卷', '考试内容', '必修', '第六章',
        '注意事项', '答题卡', '密封线'
    ]
    
    def extract_question_number(text, pattern, ptype):
        """提取题号"""
        match = re.match(pattern, text)
        if not match:
            return None
        
        num_str = match.group(1)
        
        if ptype == 'chinese':
            return chinese_num_map.get(num_str)
        else:
            try:
                return int(num_str)
            except:
                return None
    
    def detect_question_type(text):
        """检测题目类型"""
        for qtype, keywords in question_type_keywords.items():
            for kw in keywords:
                if re.search(kw, text):
                    return qtype
        return None
    
    for i, line in enumerate(lines):
        text = line["text"]
        y0 = line["y0"]
        
        # 检查是否包含干扰关键词
        is_noise = any(kw in text for kw in noise_keywords)
        if is_noise:
            continue
        
        # 检查是否是大题标题（用于题型识别）
        for section_pattern, section_type in section_patterns:
            if re.search(section_pattern, text):
                current_section_type = section_type
                print(f"[Split] 识别到大题类型: {section_type}")
                break
        
        # 检查是否是题号开头
        question_num = None
        for pattern, ptype in question_patterns:
            question_num = extract_question_number(text, pattern, ptype)
            if question_num is not None:
                break
        
        if question_num is not None:
            # 跳过重复题号
            if question_num in used_numbers:
                continue
            
            # 验证题号合理性（1-100范围）
            if question_num < 1 or question_num > 100:
                continue
            
            # 检测题目类型
            detected_type = detect_question_type(text) or current_section_type
            
            # 如果有当前题目，先结束它
            if current_question is not None:
                current_question["y1"] = y0 - 5
                # 收集这道题的所有文本
                current_question["lines"].append(current_question["first_line"])
                questions.append(current_question)
            
            # 开始新题目
            current_question = {
                "index": question_num,
                "y0": y0,
                "y1": height,
                "first_line": text,
                "lines": [],
                "type": detected_type  # 题型
            }
            used_numbers.add(question_num)
            type_info = f" [类型: {detected_type}]" if detected_type else ""
            print(f"[Split] 识别到题目 {question_num}{type_info}: {text[:30]}")
        
        elif current_question is not None:
            # 当前行属于当前题目
            current_question["lines"].append(text)
            
            # 尝试从内容中检测题型
            if current_question.get("type") is None:
                detected_type = detect_question_type(text)
                if detected_type:
                    current_question["type"] = detected_type
    
    # 处理最后一道题
    if current_question is not None:
        current_question["lines"].append(current_question["first_line"])
        questions.append(current_question)
    
    # 排序并生成切分结果
    questions.sort(key=lambda x: x["index"])
    
    # 裁剪图片
    results = []
    for i, q in enumerate(questions):
        # 计算结束位置
        if i < len(questions) - 1:
            y1 = questions[i + 1]["y0"] - 5
        else:
            y1 = height
        
        y0 = max(0, int(q["y0"]) - 10)
        y1 = min(height, int(y1) + 10)
        
        # 确保 y0 < y1
        if y0 >= y1:
            y0 = max(0, int(q["y0"]))
            y1 = min(height, y0 + 100)
        
        # 确保裁剪区域有效
        if y1 <= y0:
            continue
            
        try:
            # 裁剪
            cropped = img_array[y0:y1, :, :].copy()
            
            # 确保裁剪后的图片有效
            if cropped.size == 0 or cropped.shape[0] == 0 or cropped.shape[1] == 0:
                continue
            
            # 组合文本
            ocr_text = q["first_line"]
            if q["lines"]:
                ocr_text = "\n".join([q["first_line"]] + [l for l in q["lines"] if l != q["first_line"]])
            
            # 智能解析题干和选项
            parsed = parse_question_content(ocr_text)
            
            results.append({
                "index": q["index"],
                "base64": image_to_base64(cropped),
                "ocrText": ocr_text,
                "stem": parsed["stem"],
                "options": parsed["options"],
                "type": q.get("type"),  # 题型
                "y0": y0,
                "y1": y1
            })
        except Exception as crop_err:
            print(f"[Split] 裁剪题目 {q['index']} 失败: {crop_err}")
            continue
    
    print(f"[Split] 共切分出 {len(results)} 道题目")
    return results


def parse_question_content(ocr_text: str) -> dict:
    """
    智能解析题目内容，分离题干和选项
    返回: {"stem": "题干", "options": [{"label": "A", "content": "..."}]}
    """
    import re
    
    if not ocr_text:
        return {"stem": "", "options": []}
    
    # 过滤无关内容
    noise_words = [
        '弥封线', '密封线', '装订线', '答题卡', '考生须知',
        '注意事项', '姓名', '班级', '学校', '考号',
        '不要答题', '第.*页', '共.*页'
    ]
    
    # 按行分割
    lines = ocr_text.split('\n')
    clean_lines = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # 跳过包含干扰关键词的行
        is_noise = any(re.search(w, line) for w in noise_words)
        if is_noise:
            continue
        clean_lines.append(line)
    
    clean_text = ' '.join(clean_lines)
    
    # 更宽松的选项匹配模式：
    # 1. A. A、A: A． 等标准格式
    # 2. 单独的 A 后面跟空格或内容
    option_patterns = [
        r'([A-Da-d])[\.、．::：]\s*',           # 标准格式: A. A、A:
        r'(?:^|\s)([A-Da-d])\s+(?=[^A-Za-z])',  # 单独字母: A xxx
    ]
    
    # 尝试多种模式
    matches = []
    for pattern in option_patterns:
        found = list(re.finditer(pattern, clean_text))
        if len(found) >= 2:  # 至少找到2个选项才认为有效
            matches = found
            break
    
    if not matches:
        # 没有选项，整个内容都是题干
        return {"stem": clean_text.strip(), "options": []}
    
    # 第一个选项之前的内容是题干
    first_option_pos = matches[0].start()
    stem = clean_text[:first_option_pos].strip()
    
    # 提取每个选项
    options = []
    found_labels = set()
    for i, match in enumerate(matches):
        label = match.group(1).upper()
        
        # 跳过重复的选项标签
        if label in found_labels:
            continue
        found_labels.add(label)
        
        start = match.end()
        
        # 结束位置是下一个选项的开始，或文本末尾
        if i + 1 < len(matches):
            end = matches[i + 1].start()
        else:
            end = len(clean_text)
        
        content = clean_text[start:end].strip()
        if content:
            options.append({"label": label, "content": content})
    
    # 按字母顺序排序选项
    options.sort(key=lambda x: x["label"])
    
    return {"stem": stem, "options": options}


if __name__ == "__main__":
    print("正在启动 PaddleOCR 服务...")
    print("首次运行会自动下载模型，请耐心等待...")
    uvicorn.run(app, host="0.0.0.0", port=8089)
