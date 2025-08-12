import React from 'react';

const ProgressBar = ({ progress, darkMode }) => {
  return (
    <div className={`rounded-2xl p-6 shadow-lg ${
      darkMode 
        ? 'bg-gray-800 border border-gray-700' 
        : 'bg-white border border-gray-100'
    }`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${
            darkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Processing...
          </span>
          <span className={`text-sm font-bold ${
            darkMode ? 'text-blue-400' : 'text-blue-600'
          }`}>
            {progress}%
          </span>
        </div>
        
        <div className={`w-full h-3 rounded-full overflow-hidden ${
          darkMode ? 'bg-gray-700' : 'bg-gray-200'
        }`}>
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full 
                     transition-all duration-500 ease-out relative overflow-hidden"
            style={{ width: `${progress}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white via-transparent 
                          opacity-30 animate-pulse">
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;