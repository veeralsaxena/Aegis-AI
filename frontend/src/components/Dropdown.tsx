"use client";

import React, { useState, useRef, useEffect } from "react";

export interface DropdownOption {
  label: string;
  value: string;
  icon?: string;
}

interface DropdownProps {
  label?: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

export default function Dropdown({
  label,
  options,
  value,
  onChange,
  placeholder = "Select an option",
  className = "",
  disabled = false,
  required = false,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-3 rounded-lg border text-sm font-medium transition-colors outline-none
          ${
            disabled
              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
              : isOpen
              ? "bg-white border-slate-400 text-slate-900 shadow-sm"
              : "bg-slate-50 border-slate-200 text-slate-900 hover:bg-white focus:bg-white focus:border-slate-400"
          }
        `}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption ? (
            <>
              {selectedOption.icon && (
                <span className="material-symbols-outlined text-[18px] text-slate-500">
                  {selectedOption.icon}
                </span>
              )}
              <span>{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-slate-500">{placeholder}</span>
          )}
        </div>
        <span
          className={`material-symbols-outlined text-[20px] text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-3 text-sm text-slate-500 text-center">No options available</div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors text-left
                  ${
                    value === option.value
                      ? "bg-slate-50 text-slate-900 font-semibold"
                      : "text-slate-700 hover:bg-slate-50 font-medium"
                  }
                `}
              >
                {option.icon && (
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      value === option.value ? "text-slate-700" : "text-slate-500"
                    }`}
                  >
                    {option.icon}
                  </span>
                )}
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
