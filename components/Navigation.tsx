
import React from 'react';

interface NavigationProps {
  navigate: (path: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ navigate }) => {
  const [activeTab, setActiveTab] = React.useState<string>(window.location.hash.substring(1) || '/');

  const handleNavClick = (path: string) => {
    setActiveTab(path);
    navigate(path);
  };

  React.useEffect(() => {
    const handleHashChange = () => {
      setActiveTab(window.location.hash.substring(1) || '/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const getTabClasses = (path: string) =>
    `flex-1 text-center py-3 px-2 md:px-4 text-sm md:text-base font-semibold rounded-lg transition-all duration-200 ease-in-out
    ${activeTab === path || (activeTab === '/' && path === '/')
      ? 'bg-primary-green text-white shadow-md'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`;

  return (
    <nav className="flex justify-around bg-soft-pink p-2 rounded-xl shadow-inner mt-4 md:mt-6 sticky top-20 z-10">
      <button onClick={() => handleNavClick('/')} className={getTabClasses('/')}>
        Scan Station
      </button>
      <button onClick={() => handleNavClick('/library')} className={getTabClasses('/library')}>
        Library
      </button>
      <button onClick={() => handleNavClick('/checkout-log')} className={getTabClasses('/checkout-log')}>
        Checkout Log
      </button>
      <button onClick={() => handleNavClick('/manage-borrowers')} className={getTabClasses('/manage-borrowers')}>
        Manage Borrowers
      </button>
    </nav>
  );
};

export default Navigation;
