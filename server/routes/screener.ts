import type { Request, Response } from 'express';
import { getScreenerDb } from '../services/financeDatabaseSync';

export function handleScreenerSearch(req: Request, res: Response) {
  const query = req.query.q as string;
  const limit = parseInt(req.query.limit as string) || 20;

  if (!query || query.length < 2) {
    return res.json({ results: [] });
  }

  try {
    const db = getScreenerDb();
    const results = db.prepare(`
      SELECT symbol, name, asset_type, exchange, country, sector
      FROM assets 
      WHERE symbol LIKE ? OR name LIKE ? 
      ORDER BY 
        CASE 
          WHEN UPPER(symbol) = UPPER(?) THEN 1
          WHEN UPPER(symbol) LIKE UPPER(? || '%') AND symbol NOT LIKE '%.%' THEN 2
          WHEN UPPER(symbol) LIKE UPPER(? || '%') THEN 3
          WHEN UPPER(name) LIKE UPPER(? || '%') THEN 4
          ELSE 5
        END,
        CASE WHEN country = 'United States' THEN 1 ELSE 2 END,
        LENGTH(symbol) ASC,
        symbol ASC
      LIMIT ?
    `).all(`%${query}%`, `%${query}%`, query, query, query, query, limit);

    res.json({ results });
  } catch (error) {
    console.error('[ScreenerSearch]', error);
    res.status(500).json({ error: 'Failed to search screener database' });
  }
}

export function handleScreenerFilter(req: Request, res: Response) {
  const { sector, industry, country, asset_type, exclude_dots, limit = '50', offset = '0' } = req.query;

  try {
    const db = getScreenerDb();
    
    const conditions: string[] = [];
    const params: any[] = [];

    // Helper: split comma-separated values into an IN (?,?,...) clause
    const addMulti = (col: string, raw: string | undefined) => {
      if (!raw) return;
      const vals = (raw as string).split(',').map(v => v.trim()).filter(Boolean);
      if (vals.length === 0) return;
      const placeholders = vals.map(() => '?').join(',');
      conditions.push(`${col} IN (${placeholders})`);
      params.push(...vals);
    };

    addMulti('sector', sector as string | undefined);
    addMulti('industry', industry as string | undefined);
    addMulti('country', country as string | undefined);
    addMulti('asset_type', asset_type as string | undefined);

    // Optionally exclude symbols with dots (foreign exchange duplicates like AAPL.BA)
    if (exclude_dots === '1' || exclude_dots === 'true') {
      conditions.push("symbol NOT LIKE '%.%'");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get total count
    const countParams = [...params];
    const countQuery = `SELECT count(*) as total FROM assets ${whereClause}`;
    const totalRow = db.prepare(countQuery).get(...countParams) as { total: number };
    
    // Get paginated results — sort US primary tickers first, then by symbol length
    const resultsQuery = `
      SELECT symbol, name, asset_type, exchange, country, sector, industry, market_cap, summary
      FROM assets
      ${whereClause}
      ORDER BY
        CASE WHEN country = 'United States' THEN 1 ELSE 2 END,
        CASE WHEN symbol NOT LIKE '%.%' THEN 1 ELSE 2 END,
        LENGTH(symbol) ASC,
        symbol ASC
      LIMIT ? OFFSET ?
    `;
    
    params.push(parseInt(limit as string), parseInt(offset as string));
    const results = db.prepare(resultsQuery).all(...params);

    res.json({
      total: totalRow.total,
      results,
    });
  } catch (error) {
    console.error('[ScreenerFilter]', error);
    res.status(500).json({ error: 'Failed to filter screener database' });
  }
}

export function handleScreenerAsset(req: Request, res: Response) {
  const { symbol } = req.params;

  try {
    const db = getScreenerDb();
    const asset = db.prepare(`
      SELECT * FROM assets WHERE symbol = ?
    `).get(symbol);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found in database' });
    }

    res.json(asset);
  } catch (error) {
    console.error('[ScreenerAsset]', error);
    res.status(500).json({ error: 'Failed to fetch asset metadata' });
  }
}

export function handleScreenerFacets(_req: Request, res: Response) {
  try {
    const db = getScreenerDb();
    const asset_types = (db.prepare(
      `SELECT DISTINCT asset_type FROM assets WHERE asset_type IS NOT NULL ORDER BY asset_type`
    ).all() as { asset_type: string }[]).map(r => r.asset_type);

    const sectors = (db.prepare(
      `SELECT DISTINCT sector FROM assets WHERE sector IS NOT NULL ORDER BY sector`
    ).all() as { sector: string }[]).map(r => r.sector);

    const countries = (db.prepare(
      `SELECT DISTINCT country, count(*) as cnt FROM assets WHERE country IS NOT NULL GROUP BY country ORDER BY cnt DESC LIMIT 30`
    ).all() as { country: string; cnt: number }[]).map(r => r.country);

    res.json({ asset_types, sectors, countries });
  } catch (error) {
    console.error('[ScreenerFacets]', error);
    res.status(500).json({ error: 'Failed to fetch screener facets' });
  }
}
