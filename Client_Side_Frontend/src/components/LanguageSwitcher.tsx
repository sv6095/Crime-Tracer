import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Globe } from 'lucide-react';
import { languages } from '../i18n';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'dropdown' | 'compact';
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  className = '', 
  variant = 'dropdown' 
}) => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'compact') {
    return (
      <div className={`flex gap-1 flex-wrap ${className}`}>
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`px-2 py-1 text-xs rounded-md transition-all ${
              i18n.language === lang.code
                ? 'bg-white/20 text-white border border-white/30'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-transparent'
            }`}
            title={lang.name}
          >
            {lang.code.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-all text-white"
        aria-label={t('nav.language')}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe size={16} className="text-white/80" />
        <span className="text-sm font-medium hidden sm:inline">
          {currentLanguage.nativeName}
        </span>
        <span className="text-sm font-medium sm:hidden">
          {currentLanguage.code.toUpperCase()}
        </span>
        <ChevronDown 
          size={14} 
          className={`text-white/60 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-56 bg-black/90 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl z-50 overflow-hidden"
          role="listbox"
          aria-label="Select language"
        >
          <div className="py-2">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                role="option"
                aria-selected={i18n.language === lang.code}
                className={`w-full text-left px-4 py-3 text-sm transition-all flex items-center gap-3 ${
                  i18n.language === lang.code
                    ? 'bg-white/15 text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <div className="flex flex-col flex-1">
                  <span 
                    className="font-medium"
                    style={{ fontFamily: `'${lang.font}', sans-serif` }}
                  >
                    {lang.nativeName}
                  </span>
                  <span className="text-xs text-white/50">{lang.name}</span>
                </div>
                {i18n.language === lang.code && (
                  <span className="text-emerald-400 text-sm">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
