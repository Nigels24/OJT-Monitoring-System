"use client";

import { InputHTMLAttributes } from "react";
import { Search } from "lucide-react";

interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className"
> {
  helperText?: string;
}

export default function SearchInput({ helperText, ...rest }: SearchInputProps) {
  return (
    <div>
      <div className="flex items-center bg-white rounded-full border border-gray-200 px-4 h-12 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        <Search size={18} className="text-gray-400 shrink-0" />
        <input
          {...rest}
          className="flex-1 h-full ml-3 outline-none bg-transparent text-gray-900 placeholder:text-gray-400"
        />
      </div>
      {helperText && (
        <p className="text-xs text-gray-400 mt-1.5 ml-1">{helperText}</p>
      )}
    </div>
  );
}
