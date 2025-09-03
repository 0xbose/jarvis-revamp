"use client";

import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const categories: { id: any | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "verified", label: "Verified" },
  { id: "unverified", label: "Unverified" },
];

interface SearchAndCategoriesProps {
  onSearch: (query: string) => void;
  onCategorySelect: (category: any | "all") => void;
  isDashboard?: boolean;
  hideCategory?: boolean;
}

export default function SearchAndCategories({
  onSearch,
  onCategorySelect,
  isDashboard = false,
  hideCategory = false,
}: SearchAndCategoriesProps) {
  const [selectedCategory, setSelectedCategory] = useState<any | "all">("all");
  const [searchValue, setSearchValue] = useState<string>("");

  // Debounce logic
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      onSearch(searchValue);
    }, 800);
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const handleCategoryClick = (categoryId: any | "all") => {
    setSelectedCategory(categoryId);
    onCategorySelect(categoryId);
  };

  return (
    <div
      className={`flex w-full flex-col gap-4 ${
        isDashboard
          ? "sm:flex-row-reverse sm:items-center sm:justify-normal"
          : "sm:flex-row sm:items-center sm:justify-between"
      } `}
    >
      <div
        className={`bg-card flex h-12 ${
          isDashboard ? "w-1/4" : "w-1/3"
        } items-center rounded-md`}
      >
        <Search className="ml-3 size-4 text-[#D7D7D7]" />
        <Input
          type="search"
          placeholder="Search models..."
          className="border-none bg-transparent pl-3 text-base text-[#D7D7D7] placeholder:text-[#666666] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
        {!hideCategory && categories.map((category) => (
          <Button
            key={category.id}
            onClick={() => handleCategoryClick(category.id)}
            className={cn(
              "bg-card hover:border-primary hover:text-primary hover:bg-card/90 whitespace-nowrap border border-transparent px-3 py-1 h-10",
              selectedCategory === category.id
                ? "text-primary border-primary"
                : "text-white"
            )}
          >
            {category.label}
          </Button>
        ))}
      </div>
    </div>
  );
}