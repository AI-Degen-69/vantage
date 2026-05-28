import { useState, useMemo } from "react";
import { Search, Settings } from "lucide-react";

interface Stock {
  symbol: string;
  name: string;
  company: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: string;
}

const sp500Stocks: Stock[] = [
  { symbol: "NVDA", name: "Nvidia Corp", company: "Nvidia Corp", price: 912.60, change: 24.35, changePercent: 2.74, marketCap: "Market Cap: $2.13T" },
  { symbol: "AAPL", name: "Apple Inc", company: "Apple Inc.", price: 210.85, change: 8.42, changePercent: 4.16, marketCap: "Market Cap: $3.57T" },
  { symbol: "MSFT", name: "Microsoft Corp", company: "Microsoft Corp", price: 432.67, change: 12.54, changePercent: 3.00, marketCap: "Market Cap: $3.07T" },
  { symbol: "AMZN", name: "Amazon.com Inc", company: "Amazon.com Inc.", price: 221.85, change: 11.23, changePercent: 5.33, marketCap: "Market Cap: $2.31T" },
  { symbol: "GOOGL", name: "Alphabet Inc Class A", company: "Alphabet Inc Class A", price: 388.83, change: 15.42, changePercent: 4.13, marketCap: "Market Cap: $1.28T" },
  { symbol: "AVGO", name: "Broadcom Inc", company: "Broadcom Inc", price: 421.54, change: 9.87, changePercent: 2.39, marketCap: "Market Cap: $249.6B" },
  { symbol: "GOOG", name: "Alphabet Inc Class C", company: "Alphabet Inc Class C", price: 384.23, change: 14.56, changePercent: 3.93, marketCap: "Market Cap: $1.23T" },
  { symbol: "META", name: "Meta Platforms Inc Class A", company: "Meta Platforms Inc Class A", price: 485.34, change: 18.92, changePercent: 4.07, marketCap: "Market Cap: $1.21T" },
  { symbol: "TSLA", name: "Tesla Inc", company: "Tesla Inc.", price: 440.36, change: -12.45, changePercent: -2.75, marketCap: "Market Cap: $1.53T" },
  { symbol: "BRKA", name: "Berkshire Hathaway Inc Class B", company: "Berkshire Hathaway Inc Class B", price: 427.92, change: 8.63, changePercent: 2.06, marketCap: "Market Cap: $810.4B" },
  { symbol: "MU", name: "Micron Technology Inc", company: "Micron Technology Inc", price: 228.41, change: 5.32, changePercent: 2.38, marketCap: "Market Cap: $313.0B" },
  { symbol: "LLY", name: "Eli Lilly + Co", company: "Eli Lilly + Co", price: 1040.73, change: 32.15, changePercent: 3.18, marketCap: "Market Cap: $989.5B" },
  { symbol: "JPM", name: "JPMorgan Chase + Co", company: "JPMorgan Chase + Co", price: 299.28, change: 7.45, changePercent: 2.55, marketCap: "Market Cap: $387.0B" },
  { symbol: "AMD", name: "Advanced Micro Devices", company: "Advanced Micro Devices", price: 195.54, change: -4.23, changePercent: -2.11, marketCap: "Market Cap: $318.0B" },
  { symbol: "XOM", name: "Exxon Mobil Corp", company: "Exxon Mobil Corp", price: 140.00, change: 2.34, changePercent: 1.70, marketCap: "Market Cap: $613.4B" },
  { symbol: "INTC", name: "Intel Corp", company: "Intel Corp", price: 121.77, change: -5.23, changePercent: -4.11, marketCap: "Market Cap: $512.0B" },
  { symbol: "JNJ", name: "Johnson + Johnson", company: "Johnson + Johnson", price: 231.29, change: 3.45, changePercent: 1.51, marketCap: "Market Cap: $554.7T" },
  { symbol: "V", name: "Visa Inc Class A Shares", company: "Visa Inc Class A Shares", price: 277.41, change: 6.23, changePercent: 2.29, marketCap: "Market Cap: $627.7B" },
  { symbol: "WMT", name: "Walmart Inc", company: "Walmart Inc", price: 119.34, change: 2.15, changePercent: 1.83, marketCap: "Market Cap: $344.8B" },
  { symbol: "CSCO", name: "Cisco Systems Inc", company: "Cisco Systems Inc", price: 51.67, change: 0.92, changePercent: 1.80, marketCap: "Market Cap: $217.1B" },
  { symbol: "CostCo", name: "Costco Wholesale Corp", company: "Costco Wholesale Corp", price: 1003.69, change: 28.45, changePercent: 2.92, marketCap: "Market Cap: $443.2B" },
  { symbol: "CAT", name: "Caterpillar Inc", company: "Caterpillar Inc", price: 309.92, change: 8.12, changePercent: 2.68, marketCap: "Market Cap: $415.1B" },
  { symbol: "NFLX", name: "Netflix Inc", company: "Netflix Inc", price: 57.23, change: -3.12, changePercent: -5.17, marketCap: "Market Cap: $267.8B" },
  { symbol: "CVX", name: "Chevron Corp", company: "Chevron Corp", price: 182.42, change: 1.23, changePercent: 0.68, marketCap: "Market Cap: $363.3B" },
  { symbol: "UNH", name: "UnitedHealth Group Inc", company: "UnitedHealth Group Inc", price: 384.01, change: 12.45, changePercent: 3.35, marketCap: "Market Cap: $362.7B" },
  { symbol: "BAC", name: "Bank Of America Corp", company: "Bank Of America Corp", price: 51.10, change: -0.45, changePercent: -0.87, marketCap: "Market Cap: $362.4B" },
  { symbol: "AMAT", name: "Applied Materials Inc", company: "Applied Materials Inc", price: 446.25, change: 18.34, changePercent: 4.28, marketCap: "Market Cap: $343.5B" },
  { symbol: "PG", name: "Procter + Gamble Co", company: "Procter + Gamble Co", price: 147.52, change: 3.21, changePercent: 2.23, marketCap: "Market Cap: $343.2B" },
  { symbol: "ORCL", name: "Oracle Corp", company: "Oracle Corp", price: 190.78, change: 7.15, changePercent: 3.90, marketCap: "Market Cap: $346.6B" },
  { symbol: "ABBV", name: "AbbVie Inc", company: "AbbVie Inc", price: 215.41, change: 4.23, changePercent: 2.00, marketCap: "Market Cap: $380.5B" },
  { symbol: "KO", name: "Coca-Cola Co", company: "Coca-Cola Co", price: 81.62, change: 1.84, changePercent: 2.30, marketCap: "Market Cap: $348.2B" },
  { symbol: "PLTR", name: "Palantir Technologies Inc A", company: "Palantir Technologies Inc A", price: 132.51, change: 4.56, changePercent: 3.56, marketCap: "Market Cap: $321.4B" },
  { symbol: "HD", name: "Home Depot Inc", company: "Home Depot Inc", price: 217.85, change: 6.23, changePercent: 2.95, marketCap: "Market Cap: $315.5B" },
  { symbol: "GE", name: "General Electric", company: "General Electric", price: 317.21, change: 8.45, changePercent: 2.73, marketCap: "Market Cap: $314.3B" },
];

const tabs = [
  { id: "sp500", label: "S&P 500" },
  { id: "trending", label: "Most Trending" },
  { id: "growth", label: "Growth" },
  { id: "dividend", label: "Dividend Growth" },
  { id: "buyback", label: "Buyback Machines" },
  { id: "ai", label: "Artificial Intelligence" },
  { id: "cloud", label: "Cloud" },
  { id: "ev", label: "Electric Vehicles" },
  { id: "leisure", label: "Leisure and Entertainment" },
];

export default function Insights() {
  const [activeTab, setActiveTab] = useState("sp500");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStocks = useMemo(() => {
    return sp500Stocks.filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  return (
    <div className="w-full bg-background dark min-h-screen">
      {/* Header Section */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-8 py-12">
        <h1 className="text-4xl font-bold text-center text-foreground mb-8">Insights</h1>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto">
          <div className="relative flex items-center bg-slate-700/50 border border-slate-600 rounded-lg overflow-hidden">
            <Search className="w-4 h-4 ml-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search stocks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none border-0 px-4 py-3 text-foreground placeholder-slate-400"
            />
            <button className="flex items-center justify-center px-3 py-3 text-slate-400 hover:text-blue-400 transition-colors border-l border-slate-600">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-800/30 border-b border-slate-700 overflow-x-auto">
        <div className="flex px-8 space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button className="px-4 py-3 text-slate-400 hover:text-foreground font-medium text-sm whitespace-nowrap ml-auto">
            More ▼
          </button>
        </div>
      </div>

      {/* Stock Grid */}
      <div className="px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredStocks.map((stock) => (
            <div
              key={stock.symbol}
              className="bg-card rounded-lg p-4 border border-slate-700 hover:border-slate-600 hover:bg-slate-700/30 transition-all cursor-pointer group"
            >
              {/* Header with Logo and Price */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center text-xs font-bold text-foreground group-hover:bg-blue-600 transition-colors">
                    {stock.symbol.substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{stock.symbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">${stock.price.toFixed(2)}</p>
                  <p
                    className={`text-xs font-semibold ${
                      stock.changePercent >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {stock.changePercent >= 0 ? "+" : ""}
                    {stock.changePercent.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Company Info */}
              <p className="text-xs text-slate-400 mb-2 truncate">{stock.name}</p>
              <p className="text-xs text-slate-500">{stock.marketCap}</p>
            </div>
          ))}
        </div>

        {filteredStocks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400">No stocks found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
