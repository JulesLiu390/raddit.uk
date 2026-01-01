import { createContext, useState, useContext } from 'react';

const HeaderContext = createContext(null);

export const HeaderProvider = ({ children }) => {
  const [headerState, setHeaderState] = useState({
    title: '',
    actions: null, // Component or function to render actions
    isVisible: false // Whether the context header logic is active (e.g. only on post detail)
  });

  const setHeaderConfig = (config) => {
    setHeaderState(prev => ({ ...prev, ...config }));
  };

  const resetHeader = () => {
    setHeaderState({
      title: '',
      actions: null,
      isVisible: false
    });
  };

  return (
    <HeaderContext.Provider value={{ headerState, setHeaderConfig, resetHeader }}>
      {children}
    </HeaderContext.Provider>
  );
};

export const useHeader = () => useContext(HeaderContext);
