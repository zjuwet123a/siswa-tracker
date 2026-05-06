import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
}

export default function MultiSelect({ options, selected, onChange, placeholder = 'Pilih beberapa...', label }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, direction: 'down' as 'up' | 'down' });
  const containerRef = useRef<HTMLDivElement>(null);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 350; // Max expected height
      
      const direction = spaceBelow < dropdownHeight && rect.top > dropdownHeight ? 'up' : 'down';
      
      setCoords({
        top: direction === 'down' ? rect.bottom + window.scrollY : rect.top + window.scrollY - 8,
        left: rect.left + window.scrollX,
        width: rect.width,
        direction
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // We also need to check if the click is on the portal content
        const portal = document.getElementById('multiselect-portal-root');
        if (portal && portal.contains(event.target as Node)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    const newSelected = selected.includes(option)
      ? selected.filter(item => item !== option)
      : [...selected, option];
    onChange(newSelected);
  };

  const removeOption = (option: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(selected.filter(item => item !== option));
  };

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="multiselect-dropdown"
          initial={{ opacity: 0, y: coords.direction === 'down' ? 10 : -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: coords.direction === 'down' ? 10 : -10, scale: 0.95 }}
          style={{
            position: 'absolute',
            top: coords.direction === 'down' ? coords.top + 8 : 'auto',
            bottom: coords.direction === 'up' ? (window.innerHeight - (coords.top + 8)) : 'auto',
            left: coords.left,
            width: coords.width,
            zIndex: 9999,
          }}
          className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden dark:shadow-none min-w-[200px]"
        >
          <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center gap-3">
            <Search size={14} className="text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder="Cari klaster..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-transparent outline-none text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 placeholder:text-slate-400"
            />
          </div>
          
          <div className="max-h-[250px] overflow-y-auto p-2 custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <div
                  key={option}
                  onClick={() => toggleOption(option)}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer mb-1 ${
                    selected.includes(option)
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">{option}</span>
                  {selected.includes(option) && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tidak ditemukan</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      {label && (
        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
          {label}
        </label>
      )}
      
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[56px] max-h-[120px] overflow-y-auto custom-scrollbar w-full bg-slate-50 dark:bg-slate-900 border ${
          isOpen ? 'border-indigo-600 ring-4 ring-indigo-50 dark:ring-indigo-900/20' : 'border-slate-100 dark:border-slate-800'
        } rounded-2xl px-4 py-2 cursor-pointer transition-all flex flex-wrap gap-2 items-center content-start scroll-smooth`}
      >
        <AnimatePresence mode="popLayout">
          {selected.length > 0 ? (
            selected.map(item => (
              <motion.span
                key={item}
                layout
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tight shadow-md"
              >
                {item}
                <button
                  type="button"
                  onClick={(e) => removeOption(item, e)}
                  className="hover:bg-white/20 rounded-lg p-0.5 transition-colors"
                >
                  <X size={12} />
                </button>
              </motion.span>
            ))
          ) : (
            <span className="text-slate-400 dark:text-slate-600 text-[11px] font-black uppercase tracking-widest ml-1">
              {placeholder}
            </span>
          )}
        </AnimatePresence>
        
        <div className="ml-auto pr-1">
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {createPortal(
        <div id="multiselect-portal-root">{dropdownContent}</div>,
        document.body
      )}
    </div>
  );
}
