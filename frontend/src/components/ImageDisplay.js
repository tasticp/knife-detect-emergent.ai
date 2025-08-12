import React from 'react';
import { Image, Download, Eye, Loader } from 'lucide-react';

const ImageDisplay = ({ 
  title, 
  image, 
  processing, 
  darkMode, 
  showDownload = false, 
  onDownload,
  batchInfo = null 
}) => {
  return (
    <div className={`rounded-2xl p-6 shadow-lg transition-all duration-300 hover:shadow-xl ${
      darkMode 
        ? 'bg-gray-800 border border-gray-700' 
        : 'bg-white border border-gray-100'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`flex items-center gap-2 text-lg font-semibold ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}>
          <Eye size={18} />
          {title}
          {batchInfo && (
            <span className={`text-sm px-2 py-1 rounded-full ${
              darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
            }`}>
              {batchInfo.current} / {batchInfo.total}
            </span>
          )}
        </h3>
        
        {showDownload && (
          <button
            onClick={onDownload}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                       transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg
                       ${darkMode 
                         ? 'bg-green-600 hover:bg-green-700 text-white' 
                         : 'bg-green-600 hover:bg-green-700 text-white'
                       }`}
          >
            <Download size={16} />
            Download
          </button>
        )}
      </div>

      {/* Image Container */}
      <div className={`relative aspect-video rounded-xl overflow-hidden ${
        darkMode ? 'bg-gray-700' : 'bg-gray-100'
      }`}>
        {processing && !image ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Loader className={`w-8 h-8 animate-spin mx-auto ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`} />
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {title === 'Original Image' ? 'Loading...' : 'Processing...'}
              </div>
            </div>
          </div>
        ) : image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-contain transition-all duration-300 hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Image className={`w-16 h-16 mx-auto ${
                darkMode ? 'text-gray-600' : 'text-gray-400'
              }`} />
              <div className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                {title === 'Original Image' ? 'Upload an image to get started' : 'Detection results will appear here'}
              </div>
            </div>
          </div>
        )}
        
        {/* Processing Overlay */}
        {processing && image && title !== 'Original Image' && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Loader className="w-8 h-8 animate-spin mx-auto text-white" />
              <div className="text-white text-sm">Analyzing...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageDisplay;