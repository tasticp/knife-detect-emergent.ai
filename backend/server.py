from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import cv2
import numpy as np
import base64
import tempfile
import aiofiles
import asyncio
import zipfile
import io
from concurrent.futures import ThreadPoolExecutor
import onnxruntime as ort

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create the main app without a prefix
app = FastAPI(
    title="Knife Detection AI API",
    description="Advanced computer vision API for real-time weapon detection",
    version="2.0.0"
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Initialize ONNX model
MODEL_PATH = ROOT_DIR / "best.onnx"
CLASSES = ["knife"]
CLASS_IDS = [0]
colors = np.random.uniform(0, 255, size=(len(CLASSES), 3))

# Thread pool for CPU-intensive tasks
executor = ThreadPoolExecutor(max_workers=4)

# Global model session
model_session = None

def initialize_model():
    """Initialize the ONNX model session"""
    global model_session
    try:
        model_session = ort.InferenceSession(str(MODEL_PATH))
        logging.info("ONNX model loaded successfully")
    except Exception as e:
        logging.error(f"Failed to load ONNX model: {e}")
        model_session = None

def to_base64(img: np.ndarray) -> str:
    """Convert OpenCV image to base64 string"""
    _, buffer = cv2.imencode('.png', img)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    return img_base64

def resize_image(image: np.ndarray, width: int = 300) -> np.ndarray:
    """Resize image maintaining aspect ratio"""
    aspect_ratio = width / float(image.shape[1])
    dim = (width, int(image.shape[0] * aspect_ratio))
    resized = cv2.resize(image, dim, interpolation=cv2.INTER_AREA)
    return resized

def draw_bounding_box(img: np.ndarray, class_id: int, confidence: float, 
                     x: int, y: int, x_plus_w: int, y_plus_h: int) -> None:
    """Draw bounding box and label on image"""
    label = f"{CLASSES[class_id]} ({confidence:.2f})"
    color = colors[class_id]
    cv2.rectangle(img, (x, y), (x_plus_w, y_plus_h), color, 2)
    cv2.putText(img, label, (x - 10, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

def detect_objects(image: np.ndarray) -> np.ndarray:
    """Detect knives in the image using ONNX model"""
    if model_session is None:
        logging.error("Model not initialized")
        return image
    
    try:
        height, width, _ = image.shape
        length = max(height, width)
        square_image = np.zeros((length, length, 3), np.uint8)
        square_image[0:height, 0:width] = image
        
        scale = length / 640
        blob = cv2.dnn.blobFromImage(square_image, scalefactor=1/255, size=(640, 640), swapRB=True)
        
        # Run inference
        input_name = model_session.get_inputs()[0].name
        outputs = model_session.run(None, {input_name: blob})
        outputs = np.array([cv2.transpose(outputs[0])])
        
        boxes = []
        scores = []
        class_ids = []
        
        for i in range(outputs.shape[1]):
            classes_scores = outputs[0][i][4:]
            (minScore, maxScore, minClassLoc, (x, maxClassIndex)) = cv2.minMaxLoc(classes_scores)
            if maxScore >= 0.70 and maxClassIndex in CLASS_IDS:
                local_class_id = CLASS_IDS.index(maxClassIndex)
                box = [
                    outputs[0][i][0] - (0.5 * outputs[0][i][2]),
                    outputs[0][i][1] - (0.5 * outputs[0][i][3]),
                    outputs[0][i][2],
                    outputs[0][i][3],
                ]
                boxes.append(box)
                scores.append(maxScore)
                class_ids.append(local_class_id)
        
        result_boxes = cv2.dnn.NMSBoxes(boxes, scores, 0.25, 0.45, 0.5)
        
        detected_image = image.copy()
        for i in range(len(result_boxes)):
            index = result_boxes[i]
            box = boxes[index]
            draw_bounding_box(
                detected_image,
                class_ids[index],
                scores[index],
                round(box[0] * scale),
                round(box[1] * scale),
                round((box[0] + box[2]) * scale),
                round((box[1] + box[3]) * scale),
            )
        
        return detected_image
    except Exception as e:
        logging.error(f"Error in object detection: {e}")
        return image

async def process_single_image(file_content: bytes) -> dict:
    """Process a single image for knife detection"""
    try:
        # Convert bytes to numpy array
        nparr = np.frombuffer(file_content, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise ValueError("Invalid image format")
        
        # Resize image
        resized_image = resize_image(image, 300)
        
        # Detect objects in thread pool
        loop = asyncio.get_event_loop()
        detected_image = await loop.run_in_executor(executor, detect_objects, resized_image)
        
        return {
            'left': to_base64(resized_image),
            'center': to_base64(detected_image),
            'leftlabel': 'Original',
            'centerlabel': 'Processed Image',
        }
    except Exception as e:
        logging.error(f"Error processing image: {e}")
        raise HTTPException(status_code=400, detail=f"Error processing image: {str(e)}")

# Define Models
class DetectionResponse(BaseModel):
    left: str
    center: str
    leftlabel: str
    centerlabel: str

class BatchResponse(BaseModel):
    results: List[DetectionResponse]
    total_processed: int

# API Routes
@api_router.get("/")
async def root():
    return {
        "message": "Knife Detection AI API",
        "version": "2.0.0",
        "model_status": "loaded" if model_session else "not_loaded"
    }

@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model_session is not None,
        "timestamp": datetime.utcnow().isoformat()
    }

@api_router.post("/detect/single", response_model=DetectionResponse)
async def single_object_detection(file: UploadFile = File(...)):
    """Single image knife detection endpoint"""
    
    # Validate file
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image.")
    
    # Check file size (max 10MB)
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size too large. Maximum size is 10MB.")
    
    try:
        # Read file content
        file_content = await file.read()
        
        # Process image
        result = await process_single_image(file_content)
        
        return DetectionResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Unexpected error in single detection: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/detect/batch")
async def batch_object_detection(files: List[UploadFile] = File(...)):
    """Batch image knife detection endpoint"""
    
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    if len(files) > 100:
        raise HTTPException(status_code=400, detail="Too many files. Maximum is 100 images.")
    
    results = []
    processed_count = 0
    
    for file in files:
        try:
            # Validate file
            if not file.content_type or not file.content_type.startswith('image/'):
                continue  # Skip non-image files
                
            # Read and process file
            file_content = await file.read()
            result = await process_single_image(file_content)
            results.append(DetectionResponse(**result))
            processed_count += 1
            
        except Exception as e:
            logging.warning(f"Error processing file {file.filename}: {e}")
            continue  # Skip problematic files
    
    if processed_count == 0:
        raise HTTPException(status_code=400, detail="No valid image files could be processed")
    
    return {
        "results": results,
        "total_processed": processed_count,
        "total_files": len(files)
    }

@api_router.post("/detect/batch/download")
async def download_batch_results(files: List[UploadFile] = File(...)):
    """Process batch and return ZIP file with results"""
    
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    if len(files) > 50:  # Limit for ZIP download
        raise HTTPException(status_code=400, detail="Too many files for ZIP download. Maximum is 50 images.")
    
    try:
        # Create in-memory ZIP file
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            processed_count = 0
            
            for i, file in enumerate(files):
                if not file.content_type or not file.content_type.startswith('image/'):
                    continue
                
                try:
                    file_content = await file.read()
                    
                    # Convert to numpy array
                    nparr = np.frombuffer(file_content, np.uint8)
                    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    
                    if image is None:
                        continue
                    
                    # Process image
                    resized_image = resize_image(image, 300)
                    loop = asyncio.get_event_loop()
                    detected_image = await loop.run_in_executor(executor, detect_objects, resized_image)
                    
                    # Add original and detected images to ZIP
                    _, orig_buffer = cv2.imencode('.png', resized_image)
                    _, det_buffer = cv2.imencode('.png', detected_image)
                    
                    zip_file.writestr(f"original_{i+1:03d}.png", orig_buffer.tobytes())
                    zip_file.writestr(f"detected_{i+1:03d}.png", det_buffer.tobytes())
                    
                    processed_count += 1
                    
                except Exception as e:
                    logging.warning(f"Error processing file {file.filename}: {e}")
                    continue
        
        if processed_count == 0:
            raise HTTPException(status_code=400, detail="No valid images could be processed")
        
        zip_buffer.seek(0)
        
        return StreamingResponse(
            io.BytesIO(zip_buffer.read()),
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=knife_detection_results.zip"}
        )
        
    except Exception as e:
        logging.error(f"Error creating ZIP file: {e}")
        raise HTTPException(status_code=500, detail="Error creating ZIP file")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Initialize model on startup"""
    initialize_model()

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    executor.shutdown(wait=True)
