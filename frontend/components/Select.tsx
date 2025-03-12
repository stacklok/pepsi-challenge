"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  required = false,
  error,
  className,
  ...props
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleSelect(option: SelectOption) {
    setSelectedValue(option.value);
    onChange?.(option.value);
    setIsOpen(false);
  }

  const selectedOption = options.find(
    (option) => option.value === selectedValue
  );

  return (
    <div
      ref={dropdownRef}
      className={cn(
        "relative w-full rounded-lg ",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
      {...props}
    >
      <div
        className="flex items-center justify-between px-4 py-2 border border-gray-700 rounded-lg cursor-pointer"
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={cn("text-sm", !selectedOption && "text-gray-400")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <ChevronDownIcon className="w-5 h-5" />
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-auto">
          {options.map((option) => (
            <div
              key={option.value}
              className={cn(
                "px-4 py-2 text-sm cursor-pointer hover:bg-gray-700",
                option.value === selectedValue &&
                  "bg-blue-600 hover:bg-blue-700"
              )}
              onClick={() => handleSelect(option)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
