import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FolderOpen, FileArchive, CloudUpload } from 'lucide-react';

const ImageUploadZone = ({ 
  activeTab, 
  processing, 
  onSingleUpload, 
  onBatchUpload, 
  onBatchDownloadZip, 
  darkMode 
}) => {
  const [draggedFiles, setDraggedFiles] = useState([]);

  const onDrop = useCallback((acceptedFiles) => {
    if (activeTab === 'single') {
      onSingleUpload(acceptedFiles);
    } else {
      onBatchUpload(acceptedFiles);
    }
    setDraggedFiles([]);
  }, [activeTab, onSingleUpload, onBatchUpload]);

  const onDragEnter = useCallback((files) => {
    setDraggedFiles(files);
  }, []);

  const onDragLeave = useCallback(() => {
    setDraggedFiles([]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter,
    onDragLeave,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp']
    },
    multiple: activeTab === 'batch',
    disabled: processing
  });

  const handleBatchZipDownload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.webkitdirectory = activeTab === 'batch';
    
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      onBatchDownloadZip(files);
    };
    
    input.click();
  };

  return (
    <div className="space-y-6">
      {/* Main Upload Zone */}
      <div
        {...getRootProps()}
        className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-12 
                   text-center transition-all duration-300 cursor-pointer group
                   ${processing ? 'pointer-events-none opacity-50' : ''}
                   ${isDragActive || draggedFiles.length > 0
                     ? darkMode
                       ? 'border-blue-400 bg-blue-900 bg-opacity-20'
                       : 'border-blue-400 bg-blue-50'
                     : darkMode
                       ? 'border-gray-600 bg-gray-800 hover:border-gray-500 hover:bg-gray-750'
                       : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
                   }
                   shadow-lg hover:shadow-xl`}
      >
        <input {...getInputProps()} />
        
        {/* Animated Background Effect */}
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
                        ${darkMode ? 'bg-gradient-to-r from-blue-900 to-purple-900' : 'bg-gradient-to-r from-blue-100 to-purple-100'}`}>
        </div>
        
        <div className="relative z-10">
          {processing ? (
            <div className="space-y-4">
              <div className="animate-spin mx-auto w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
              <div className={`text-lg font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Processing your {activeTab === 'single' ? 'image' : 'images'}...
              </div>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Please wait while we analyze the content
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`mx-auto transition-all duration-300 group-hover:scale-110 ${
                isDragActive ? 'scale-110' : ''
              }`}>
                {activeTab === 'single' ? (
                  <CloudUpload className={`w-20 h-20 mx-auto ${
                    isDragActive 
                      ? 'text-blue-500' 
                      : darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                ) : (
                  <FolderOpen className={`w-20 h-20 mx-auto ${
                    isDragActive 
                      ? 'text-blue-500' 
                      : darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                )}
              </div>
              
              <div className="space-y-2">
                <div className={`text-xl font-semibold ${
                  isDragActive 
                    ? 'text-blue-600' 
                    : darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {isDragActive 
                    ? `Drop your ${activeTab === 'single' ? 'image' : 'images'} here`
                    : `Drop your ${activeTab === 'single' ? 'image' : 'images'} here`
                  }
                </div>
                
                <div className={`text-base ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  or click to {activeTab === 'single' ? 'browse files' : 'select a folder'}
                </div>
                
                <div className={`text-sm ${
                  darkMode ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  {activeTab === 'single' 
                    ? 'Supports: JPEG, PNG, GIF, BMP, WebP (max 10MB)'
                    : 'Supports: Multiple images from a folder (max 100 files)'
                  }
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Drag Indicator */}
        {isDragActive && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-10 flex items-center justify-center">
            <div className={`rounded-full p-4 ${
              darkMode ? 'bg-blue-900' : 'bg-blue-100'
            }`}>
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        )}
      </div>

      {/* Batch Actions */}
      {activeTab === 'batch' && !processing && (
        <div className="flex justify-center">
          <button
            onClick={handleBatchZipDownload}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium 
                       transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl
                       ${darkMode 
                         ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                         : 'bg-purple-600 hover:bg-purple-700 text-white'
                       }`}
          >
            <FileArchive size={18} />
            Process & Download ZIP
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageUploadZone;