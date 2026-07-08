# SGW Arbitrage

ShopGoodwill price arbitrage finder + automatic bid sniper.

Scans ShopGoodwill for underpriced items, compares against eBay sold prices,
and automatically places last-second bids on items you flag.

## Setup

### 1. Python backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Copy and fill in credentials:
```bash
cp ../.env.example .env
# Edit .env with your SGW credentials and eBay App ID
```

Copy sniper config:
```bash
cp config.json.example config.json
# Edit config.json with your SGW credentials
```

Start the API server:
```bash
source .env && uvicorn api:app --reload --port 8000
```

### 2. Next.js dashboard

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

---

## How It Works

### Scanning
1. Every N minutes (configurable), the scanner searches SGW for each keyword
2. Items pass through a 3-stage filter:
   - **Stage 1**: Junk word exclusion, bid range filter (instant)
   - **Stage 2**: GPT-4o-mini cleans the title for eBay search (or regex fallback)
   - **Stage 3**: eBay sold price lookup — requires ≥5 sold comps
3. Profit calculated: `(eBay median × 0.87) - SGW bid - shipping`
4. Deals above your threshold appear in the dashboard

### Sniping
1. Click "+ Add to Sniper" on any deal, set your max bid
2. Item is added to your SGW favorites with `{"max_bid": X}` in the notes
3. Start the sniper from the Watchlist page
4. Sniper fires exactly 30 seconds before auction end

### Getting eBay App ID
1. Go to https://developer.ebay.com
2. Create a free account
3. Create an application — get the Production App ID
4. Free tier: 5,000 API calls/day (more than enough)

---

## Cost Per Scan (20 keywords, ~3000 items)
| Step | Cost |
|------|------|
| SGW API | Free |
| GPT-4o-mini title cleaning (~900 items) | ~$0.09 |
| eBay API | Free (5k/day limit) |
| **Total per scan** | **~$0.09** |
