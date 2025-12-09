@echo off
chcp 65001 >nul
echo ================================
echo   Yi Xiao Juan OCR Service
echo ================================
echo.

REM Check Python
python --version
if errorlevel 1 (
    echo [Error] Python not found, please install Python 3.8+
    pause
    exit /b 1
)

echo.
echo [1/2] Installing dependencies...
echo.
pip install fastapi uvicorn python-multipart Pillow numpy
if errorlevel 1 (
    echo [Warning] Some packages failed, trying with mirrors...
    pip install fastapi uvicorn python-multipart Pillow numpy -i https://pypi.tuna.tsinghua.edu.cn/simple
)

echo.
echo Installing PaddlePaddle and PaddleOCR...
pip install paddlepaddle paddleocr -i https://pypi.tuna.tsinghua.edu.cn/simple

echo.
echo [2/2] Starting OCR service...
echo.
echo Service URL: http://localhost:8089
echo First run will download PaddleOCR model (~400MB), please wait...
echo.
echo ================================
echo.

python main.py

pause
