

import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="w-full text-center py-4 md:py-8 bg-gradient-to-r from-soft-pink to-accent-yellow rounded-b-xl shadow-lg sticky top-0 z-10">
      <h1 className="text-3xl md:text-5xl font-extrabold text-text-dark drop-shadow-md">
        <span className="inline-block transform -rotate-3 hover:rotate-0 transition-transform duration-200">Home</span>{' '}
        <span className="inline-block transform rotate-3 hover:rotate-0 transition-transform duration-200">Library</span>
      </h1>
      <p className="text-lg md:text-xl text-text-dark mt-2 italic">Read, Share, Grow!</p>
    </header>
  );
};

export default Header;