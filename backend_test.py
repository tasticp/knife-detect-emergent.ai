#!/usr/bin/env python3
"""
Backend API Testing Suite for Knife Detection AI
Tests all FastAPI endpoints with comprehensive scenarios
"""

import requests
import json
import base64
import io
import zipfile
from PIL import Image
import numpy as np
import os
import sys
from pathlib import Path

# Backend URL from environment
BACKEND_URL = "https://6da050f6-3d11-4aa4-bde4-be3bb3dd5724.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class KnifeDetectionAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        
    def log_test(self, test_name, success, message="", details=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details
        })
    
    def create_test_image(self, width=400, height=300, format='PNG'):
        """Create a test image in memory"""
        # Create a simple test image with some patterns
        img_array = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
        
        # Add some recognizable patterns
        img_array[50:100, 50:150] = [255, 0, 0]  # Red rectangle
        img_array[150:200, 200:300] = [0, 255, 0]  # Green rectangle
        
        img = Image.fromarray(img_array)
        
        # Convert to bytes
        img_buffer = io.BytesIO()
        img.save(img_buffer, format=format)
        img_buffer.seek(0)
        
        return img_buffer.getvalue()
    
    def create_large_image(self, size_mb=12):
        """Create a large test image exceeding size limits"""
        # Calculate dimensions for approximately size_mb MB
        pixels_needed = (size_mb * 1024 * 1024) // 3  # 3 bytes per pixel (RGB)
        width = int(np.sqrt(pixels_needed))
        height = width
        
        img_array = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
        img = Image.fromarray(img_array)
        
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        return img_buffer.getvalue()
    
    def test_health_endpoints(self):
        """Test health check endpoints"""
        print("\n=== Testing Health Endpoints ===")
        
        # Test root endpoint
        try:
            response = self.session.get(f"{API_BASE}/")
            if response.status_code == 200:
                data = response.json()
                expected_keys = ["message", "version", "model_status"]
                has_keys = all(key in data for key in expected_keys)
                self.log_test(
                    "Root Health Check", 
                    has_keys and data.get("version") == "2.0.0",
                    f"Status: {response.status_code}, Data: {data}"
                )
            else:
                self.log_test("Root Health Check", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Root Health Check", False, f"Exception: {str(e)}")
        
        # Test detailed health endpoint
        try:
            response = self.session.get(f"{API_BASE}/health")
            if response.status_code == 200:
                data = response.json()
                expected_keys = ["status", "model_loaded", "timestamp"]
                has_keys = all(key in data for key in expected_keys)
                self.log_test(
                    "Detailed Health Check", 
                    has_keys and data.get("status") == "healthy",
                    f"Status: {response.status_code}, Model loaded: {data.get('model_loaded')}"
                )
            else:
                self.log_test("Detailed Health Check", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Detailed Health Check", False, f"Exception: {str(e)}")
    
    def test_single_image_detection(self):
        """Test single image detection endpoint"""
        print("\n=== Testing Single Image Detection ===")
        
        # Test valid PNG image
        try:
            test_image = self.create_test_image(format='PNG')
            files = {'file': ('test.png', test_image, 'image/png')}
            
            response = self.session.post(f"{API_BASE}/detect/single", files=files)
            
            if response.status_code == 200:
                data = response.json()
                expected_keys = ["left", "center", "leftlabel", "centerlabel"]
                has_keys = all(key in data for key in expected_keys)
                
                # Validate base64 images
                valid_base64 = True
                try:
                    base64.b64decode(data.get("left", ""))
                    base64.b64decode(data.get("center", ""))
                except:
                    valid_base64 = False
                
                self.log_test(
                    "Single Detection - Valid PNG", 
                    has_keys and valid_base64,
                    f"Status: {response.status_code}, Keys present: {has_keys}, Valid base64: {valid_base64}"
                )
            else:
                self.log_test("Single Detection - Valid PNG", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Single Detection - Valid PNG", False, f"Exception: {str(e)}")
        
        # Test valid JPEG image
        try:
            test_image = self.create_test_image(format='JPEG')
            files = {'file': ('test.jpg', test_image, 'image/jpeg')}
            
            response = self.session.post(f"{API_BASE}/detect/single", files=files)
            
            success = response.status_code == 200
            self.log_test(
                "Single Detection - Valid JPEG", 
                success,
                f"Status: {response.status_code}"
            )
        except Exception as e:
            self.log_test("Single Detection - Valid JPEG", False, f"Exception: {str(e)}")
        
        # Test invalid file type
        try:
            files = {'file': ('test.txt', b'This is not an image', 'text/plain')}
            response = self.session.post(f"{API_BASE}/detect/single", files=files)
            
            success = response.status_code == 400
            self.log_test(
                "Single Detection - Invalid File Type", 
                success,
                f"Status: {response.status_code} (expected 400)"
            )
        except Exception as e:
            self.log_test("Single Detection - Invalid File Type", False, f"Exception: {str(e)}")
        
        # Test oversized file
        try:
            large_image = self.create_large_image(12)  # 12MB image
            files = {'file': ('large.png', large_image, 'image/png')}
            
            response = self.session.post(f"{API_BASE}/detect/single", files=files)
            
            success = response.status_code == 400
            self.log_test(
                "Single Detection - Oversized File", 
                success,
                f"Status: {response.status_code} (expected 400)"
            )
        except Exception as e:
            self.log_test("Single Detection - Oversized File", False, f"Exception: {str(e)}")
    
    def test_batch_image_detection(self):
        """Test batch image detection endpoint"""
        print("\n=== Testing Batch Image Detection ===")
        
        # Test valid batch with multiple images
        try:
            files = []
            for i in range(3):
                test_image = self.create_test_image(format='PNG')
                files.append(('files', (f'test_{i}.png', test_image, 'image/png')))
            
            response = self.session.post(f"{API_BASE}/detect/batch", files=files)
            
            if response.status_code == 200:
                data = response.json()
                expected_keys = ["results", "total_processed", "total_files"]
                has_keys = all(key in data for key in expected_keys)
                
                results_valid = (
                    isinstance(data.get("results"), list) and
                    len(data.get("results", [])) > 0 and
                    data.get("total_processed") == 3
                )
                
                self.log_test(
                    "Batch Detection - Multiple Valid Images", 
                    has_keys and results_valid,
                    f"Status: {response.status_code}, Processed: {data.get('total_processed')}/3"
                )
            else:
                self.log_test("Batch Detection - Multiple Valid Images", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Batch Detection - Multiple Valid Images", False, f"Exception: {str(e)}")
        
        # Test empty batch
        try:
            response = self.session.post(f"{API_BASE}/detect/batch", files=[])
            
            success = response.status_code == 400
            self.log_test(
                "Batch Detection - Empty Batch", 
                success,
                f"Status: {response.status_code} (expected 400)"
            )
        except Exception as e:
            self.log_test("Batch Detection - Empty Batch", False, f"Exception: {str(e)}")
        
        # Test batch with mixed file types
        try:
            files = [
                ('files', ('test1.png', self.create_test_image(format='PNG'), 'image/png')),
                ('files', ('test2.txt', b'Not an image', 'text/plain')),
                ('files', ('test3.jpg', self.create_test_image(format='JPEG'), 'image/jpeg'))
            ]
            
            response = self.session.post(f"{API_BASE}/detect/batch", files=files)
            
            if response.status_code == 200:
                data = response.json()
                # Should process only the 2 valid images
                success = data.get("total_processed") == 2
                self.log_test(
                    "Batch Detection - Mixed File Types", 
                    success,
                    f"Status: {response.status_code}, Processed: {data.get('total_processed')}/3 (expected 2)"
                )
            else:
                self.log_test("Batch Detection - Mixed File Types", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Batch Detection - Mixed File Types", False, f"Exception: {str(e)}")
    
    def test_zip_download(self):
        """Test ZIP download endpoint"""
        print("\n=== Testing ZIP Download ===")
        
        # Test valid ZIP download
        try:
            files = []
            for i in range(2):
                test_image = self.create_test_image(format='PNG')
                files.append(('files', (f'test_{i}.png', test_image, 'image/png')))
            
            response = self.session.post(f"{API_BASE}/detect/batch/download", files=files)
            
            if response.status_code == 200:
                # Check if response is a ZIP file
                content_type = response.headers.get('content-type', '')
                is_zip = 'application/zip' in content_type
                
                # Try to read as ZIP
                zip_valid = False
                try:
                    zip_buffer = io.BytesIO(response.content)
                    with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
                        file_list = zip_file.namelist()
                        # Should have original and detected images
                        zip_valid = len(file_list) >= 4  # At least 2 original + 2 detected
                except:
                    pass
                
                self.log_test(
                    "ZIP Download - Valid Request", 
                    is_zip and zip_valid,
                    f"Status: {response.status_code}, Content-Type: {content_type}, ZIP valid: {zip_valid}"
                )
            else:
                self.log_test("ZIP Download - Valid Request", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("ZIP Download - Valid Request", False, f"Exception: {str(e)}")
        
        # Test empty ZIP request
        try:
            response = self.session.post(f"{API_BASE}/detect/batch/download", files=[])
            
            success = response.status_code == 400
            self.log_test(
                "ZIP Download - Empty Request", 
                success,
                f"Status: {response.status_code} (expected 400)"
            )
        except Exception as e:
            self.log_test("ZIP Download - Empty Request", False, f"Exception: {str(e)}")
    
    def test_mock_detection_system(self):
        """Test that mock detection system is working properly"""
        print("\n=== Testing Mock Detection System ===")
        
        try:
            # Test multiple images to verify mock detection variability
            detection_results = []
            
            for i in range(5):
                test_image = self.create_test_image(format='PNG')
                files = {'file': (f'test_{i}.png', test_image, 'image/png')}
                
                response = self.session.post(f"{API_BASE}/detect/single", files=files)
                
                if response.status_code == 200:
                    data = response.json()
                    # Check if images are different (mock detection should add different elements)
                    left_img = data.get("left", "")
                    center_img = data.get("center", "")
                    
                    detection_results.append({
                        "left": left_img,
                        "center": center_img,
                        "different": left_img != center_img
                    })
            
            # Verify mock system is working
            all_processed = len(detection_results) == 5
            some_different = any(result["different"] for result in detection_results)
            
            self.log_test(
                "Mock Detection System", 
                all_processed and some_different,
                f"Processed: {len(detection_results)}/5, Some detections different: {some_different}"
            )
            
        except Exception as e:
            self.log_test("Mock Detection System", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all test suites"""
        print("🔍 Starting Knife Detection API Backend Tests")
        print(f"🌐 Testing against: {API_BASE}")
        
        self.test_health_endpoints()
        self.test_single_image_detection()
        self.test_batch_image_detection()
        self.test_zip_download()
        self.test_mock_detection_system()
        
        # Summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🚨 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        return passed_tests, failed_tests, self.test_results

if __name__ == "__main__":
    tester = KnifeDetectionAPITester()
    passed, failed, results = tester.run_all_tests()
    
    # Exit with error code if tests failed
    sys.exit(0 if failed == 0 else 1)