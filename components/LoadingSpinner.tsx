

import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex justify-center items-center py-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary-green"></div>
      <p className="ml-4 text-lg text-gray-600">Loading...</p>
    </div>
  );
};

export default LoadingSpinner;