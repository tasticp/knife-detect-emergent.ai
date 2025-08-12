import React, { useState, useCallback } from 'react';
import { Shield, Moon, Sun, Upload, FolderOpen, Download, FileArchive, AlertCircle, CheckCircle, Info } from 'lucide-react';
import ImageUploadZone from './ImageUploadZone';
import ImageDisplay from './ImageDisplay';
import ProgressBar from './ProgressBar';
import Notification from './Notification';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const KnifeDetectionApp = () => {
  const [activeTab, setActiveTab] = useState('single');
  const [darkMode, setDarkMode] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notification, setNotification] = useState(null);
  const [results, setResults] = useState({
    original: null,
    detected: null,
    downloadUrl: null
  });
  const [batchResults, setBatchResults] = useState([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  const resetResults = () => {
    setResults({ original: null, detected: null, downloadUrl: null });
    setBatchResults([]);
    setCurrentBatchIndex(0);
    setProgress(0);
  };

  const handleSingleImageUpload = async (files) => {
    if (files.length === 0) return;
    
    const file = files[0];
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      showNotification('Please select a valid image file', 'error');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      showNotification('File size must be less than 10MB', 'error');
      return;
    }

    setProcessing(true);
    setProgress(0);
    
    try {
      // Show original image immediately
      const originalUrl = URL.createObjectURL(file);
      setResults(prev => ({ ...prev, original: originalUrl }));
      
      const formData = new FormData();
      formData.append('file', file);
      
      setProgress(50);
      
      const response = await axios.post(`${API}/detect/single`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setProgress(100);
      
      const detectedUrl = `data:image/png;base64,${response.data.center}`;
      setResults(prev => ({
        ...prev,
        detected: detectedUrl,
        downloadUrl: detectedUrl
      }));
      
      showNotification('Image processed successfully!', 'success');
      
    } catch (error) {
      console.error('Error processing image:', error);
      showNotification(
        error.response?.data?.detail || 'Error processing image. Please try again.',
        'error'
      );
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const handleBatchImageUpload = async (files) => {
    if (files.length === 0) return;
    
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      showNotification('No valid image files found', 'error');
      return;
    }
    
    if (imageFiles.length > 100) {
      showNotification('Too many files. Please select fewer than 100 images.', 'error');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setBatchResults([]);
    setCurrentBatchIndex(0);
    
    // Show first image immediately
    const firstImageUrl = URL.createObjectURL(imageFiles[0]);
    setResults(prev => ({ ...prev, original: firstImageUrl }));
    
    try {
      const formData = new FormData();
      imageFiles.forEach(file => {
        formData.append('files', file);
      });
      
      setProgress(25);
      showNotification(`Processing ${imageFiles.length} images...`, 'info');
      
      const response = await axios.post(`${API}/detect/batch`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setProgress(75);
      
      const results = response.data.results;
      setBatchResults(results);
      
      // Display first result
      if (results.length > 0) {
        const firstResult = results[0];
        setResults({
          original: `data:image/png;base64,${firstResult.left}`,
          detected: `data:image/png;base64,${firstResult.center}`,
          downloadUrl: `data:image/png;base64,${firstResult.center}`
        });
      }
      
      setProgress(100);
      showNotification(`Successfully processed ${results.length} images!`, 'success');
      
      // Auto-cycle through results
      if (results.length > 1) {
        setTimeout(() => startBatchCycle(results), 1000);
      }
      
    } catch (error) {
      console.error('Error processing batch:', error);
      showNotification(
        error.response?.data?.detail || 'Error processing batch. Please try again.',
        'error'
      );
    } finally {
      setProcessing(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const startBatchCycle = (results) => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < results.length) {
        const result = results[index];
        setResults({
          original: `data:image/png;base64,${result.left}`,
          detected: `data:image/png;base64,${result.center}`,
          downloadUrl: `data:image/png;base64,${result.center}`
        });
        setCurrentBatchIndex(index);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 1500);
  };

  const handleBatchDownloadZip = async (files) => {
    if (files.length === 0) return;
    
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      showNotification('No valid image files found', 'error');
      return;
    }
    
    if (imageFiles.length > 50) {
      showNotification('Too many files for ZIP download. Maximum is 50 images.', 'error');
      return;
    }

    setProcessing(true);
    showNotification('Creating ZIP file...', 'info');
    
    try {
      const formData = new FormData();
      imageFiles.forEach(file => {
        formData.append('files', file);
      });
      
      const response = await axios.post(`${API}/detect/batch/download`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'knife_detection_results.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      showNotification('ZIP file downloaded successfully!', 'success');
      
    } catch (error) {
      console.error('Error creating ZIP:', error);
      showNotification('Error creating ZIP file', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const downloadSingleResult = () => {
    if (!results.downloadUrl) return;
    
    const link = document.createElement('a');
    link.href = results.downloadUrl;
    link.download = 'knife_detection_result.png';
    link.click();
  };

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
    }`}>
      {/* Notification */}
      {notification && (
        <Notification 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)}
        />
      )}

      <div className={`container mx-auto px-4 py-8 max-w-7xl`}>
        {/* Header */}
        <div className={`relative overflow-hidden rounded-2xl p-8 mb-8 ${
          darkMode 
            ? 'bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900' 
            : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600'
        } text-white shadow-2xl`}>
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <button
            onClick={toggleTheme}
            className="absolute top-4 right-4 bg-white bg-opacity-20 hover:bg-opacity-30 
                     backdrop-blur-sm rounded-lg px-4 py-2 transition-all duration-300 
                     flex items-center gap-2 text-sm font-medium z-20"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          
          <div className="relative z-10 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Shield className="w-12 h-12" />
              <h1 className="text-4xl md:text-5xl font-bold">Knife Detection AI</h1>
            </div>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">
              Advanced computer vision for real-time weapon detection with enhanced accuracy and speed
            </p>
          </div>
        </div>

        {/* Instructions Card */}
        <div className={`rounded-2xl p-6 mb-8 shadow-lg transition-all duration-300 ${
          darkMode 
            ? 'bg-gray-800 border border-gray-700' 
            : 'bg-white border border-gray-100'
        }`}>
          <h3 className={`flex items-center gap-2 text-xl font-semibold mb-4 ${
            darkMode ? 'text-blue-400' : 'text-blue-600'
          }`}>
            <Info size={20} />
            How to Use
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Single Detection</div>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Upload one image for instant analysis
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Batch Processing</div>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Process multiple images from a folder
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Drag & Drop</div>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Simply drag files onto the upload area
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Download Results</div>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Save processed images with detections
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`rounded-2xl p-2 mb-8 shadow-lg ${
          darkMode ? 'bg-gray-800' : 'bg-gray-100'
        }`}>
          <div className="flex">
            <button
              onClick={() => { setActiveTab('single'); resetResults(); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl 
                       transition-all duration-300 font-medium ${
                activeTab === 'single'
                  ? darkMode 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-blue-600 text-white shadow-lg'
                  : darkMode
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white'
              }`}
            >
              <Upload size={18} />
              Single Detection
            </button>
            <button
              onClick={() => { setActiveTab('batch'); resetResults(); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl 
                       transition-all duration-300 font-medium ${
                activeTab === 'batch'
                  ? darkMode 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-blue-600 text-white shadow-lg'
                  : darkMode
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white'
              }`}
            >
              <FolderOpen size={18} />
              Batch Detection
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {/* Upload Zone */}
          <ImageUploadZone
            activeTab={activeTab}
            processing={processing}
            onSingleUpload={handleSingleImageUpload}
            onBatchUpload={handleBatchImageUpload}
            onBatchDownloadZip={handleBatchDownloadZip}
            darkMode={darkMode}
          />

          {/* Progress Bar */}
          {processing && progress > 0 && (
            <ProgressBar progress={progress} darkMode={darkMode} />
          )}

          {/* Results Display */}
          <div className="grid lg:grid-cols-2 gap-8">
            <ImageDisplay
              title="Original Image"
              image={results.original}
              processing={processing}
              darkMode={darkMode}
            />
            <ImageDisplay
              title="Detected Image"
              image={results.detected}
              processing={processing}
              darkMode={darkMode}
              showDownload={!!results.downloadUrl && !processing}
              onDownload={downloadSingleResult}
              batchInfo={activeTab === 'batch' && batchResults.length > 0 ? {
                current: currentBatchIndex + 1,
                total: batchResults.length
              } : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnifeDetectionApp;