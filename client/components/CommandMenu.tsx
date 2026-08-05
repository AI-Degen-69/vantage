import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useScreenerSearch } from "@/hooks/useStockData";
import { useI18n } from "@/lib/i18n";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export default function CommandMenu({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useScreenerSearch(debouncedQuery, 10);
  const results = data?.results ?? [];

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen]);

  const handleSelect = (symbol: string) => {
    setOpen(false);
    navigate(`/stock/${symbol}`);
    setQuery("");
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder="Search for a company or symbol (e.g. AAPL)..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.length > 0 && isLoading && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Searching database...
          </div>
        )}
        <CommandEmpty>No results found for "{query}".</CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Stocks & Assets">
            {results.map((item) => (
              <CommandItem
                key={item.symbol}
                value={`${item.symbol} ${item.name}`}
                onSelect={() => handleSelect(item.symbol)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">
                    {item.symbol}
                  </span>
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {item.name}
                  </span>
                </div>
                <div className="flex gap-2 text-xs">
                  {item.asset_type && (
                    <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {item.asset_type}
                    </span>
                  )}
                  {item.exchange && (
                    <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground hidden sm:inline-flex">
                      {item.exchange}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
