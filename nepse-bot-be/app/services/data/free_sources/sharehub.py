"""
ShareHub Scraper
================

Scrapes live market data from sharehub.com (sharehub.com.np).

ShareHub provides:
  - Live market prices (during trading hours)
  - Today's share price table
  - Top gainers/losers/turnover

Configuration:
  - Uses proxy rotator for anti-ban protection
  - Randomized request intervals (jitter)
  - User-agent rotation
  - Cookie persistence for session continuity
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

import httpx
from bs4 import BeautifulSoup

from .cache import get_cache
from .proxy_rotator import get_rotator

logger = logging.getLogger(__name__)

_BASE_URL = "https://www.sharehub.com.np"
_CACHE = get_cache()
_rotator = get_rotator()

_HEADERS_BASE = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://www.sharehub.com.np/",
    "Connection": "keep-alive",
}


async def _fetch_page(path: str, timeout: float = 15.0) -> Optional[str]:
    """Fetch an HTML page from ShareHub with proxy rotation and jitter."""
    url = f"{_BASE_URL}{path}"
    headers, proxy_url = _rotator.next_async()
    headers.update(_HEADERS_BASE)

    await _rotator.jitter(200, 800)

    try:
        async with httpx.AsyncClient(
            proxies=_rotator.httpx_proxies(proxy_url),
            timeout=timeout,
            follow_redirects=True,
            http2=True,
        ) as client:
            resp = await client.get(url, headers=headers)

            if resp.status_code == 429:
                _rotator.report_rate_limited(proxy_url, 120)
                logger.warning("ShareHub: 429 rate limited on %s", path)
                return None

            if resp.status_code == 403:
                _rotator.report_failure(proxy_url)
                logger.warning("ShareHub: 403 forbidden on %s", path)
                return None

            if resp.status_code != 200:
                logger.warning("ShareHub: HTTP %d on %s", resp.status_code, path)
                return None

            _rotator.report_success(proxy_url)
            return resp.text

    except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadTimeout) as e:
        _rotator.report_failure(proxy_url)
        logger.debug("ShareHub: network error on %s — %s", path, e)
        return None
    except Exception as e:
        logger.warning("ShareHub: unexpected error on %s — %s", path, e)
        return None


def _parse_number(text: str) -> float:
    """Parse a number string, handling commas and parentheses for negatives."""
    if not text:
        return 0.0
    text = text.strip().replace(",", "").replace(" ", "")
    if text.startswith("(") and text.endswith(")"):
        text = "-" + text[1:-1]
    try:
        return float(text)
    except ValueError:
        return 0.0


async def get_live_market() -> List[Dict[str, Any]]:
    """Fetch current live market data from ShareHub."""

    async def _loader():
        html = await _fetch_page("/today-share-price")
        if not html:
            html = await _fetch_page("/live-trading")
        if not html:
            return []

        soup = BeautifulSoup(html, "lxml")
        table = soup.find("table", {"class": re.compile(r"table|stock|share", re.I)})
        if not table:
            tables = soup.find_all("table")
            table = tables[0] if tables else None
        if not table:
            return []

        rows = table.find_all("tr")[1:]  # skip header
        stocks: List[Dict[str, Any]] = []

        for row in rows:
            cols = row.find_all("td")
            if len(cols) < 6:
                continue
            try:
                symbol = cols[0].get_text(strip=True).upper()
                if not symbol or len(symbol) > 20:
                    continue

                ltp = _parse_number(cols[1].get_text(strip=True))
                change = _parse_number(cols[2].get_text(strip=True)) if len(cols) > 2 else 0
                pct = _parse_number(cols[3].get_text(strip=True)) if len(cols) > 3 else 0
                high = _parse_number(cols[4].get_text(strip=True)) if len(cols) > 4 else ltp
                low = _parse_number(cols[5].get_text(strip=True)) if len(cols) > 5 else ltp
                volume = _parse_number(cols[6].get_text(strip=True)) if len(cols) > 6 else 0
                turnover = _parse_number(cols[7].get_text(strip=True)) if len(cols) > 7 else 0

                if ltp <= 0:
                    continue

                stocks.append({
                    "symbol": symbol,
                    "ltp": ltp,
                    "change": change,
                    "percent_change": pct,
                    "high": high,
                    "low": low,
                    "open": ltp - change,
                    "volume": int(volume),
                    "turnover": turnover,
                    "prev_close": ltp - change,
                    "source": "sharehub",
                })
            except (IndexError, ValueError):
                continue

        return stocks

    return await _CACHE.aget_or_set("sharehub:live", _loader, ttl=45)


async def get_top_stocks() -> Dict[str, List[Dict[str, Any]]]:
    """Get top gainers, losers, and by turnover from ShareHub."""

    async def _loader():
        html = await _fetch_page("/")
        if not html:
            return {}

        soup = BeautifulSoup(html, "lxml")
        result: Dict[str, List[Dict[str, Any]]] = {
            "gainers": [],
            "losers": [],
            "turnover": [],
        }

        sections = soup.find_all("div", {"class": re.compile(r"gainer|loser|turnover|top", re.I)})
        for section in sections:
            title = section.find(["h2", "h3", "h4"])
            title_text = title.get_text(strip=True).lower() if title else ""
            category = None
            if "gain" in title_text:
                category = "gainers"
            elif "los" in title_text:
                category = "losers"
            elif "turnover" in title_text:
                category = "turnover"

            if not category:
                continue

            table = section.find("table")
            if not table:
                continue

            for row in table.find_all("tr")[1:6]:
                cols = row.find_all("td")
                if len(cols) >= 3:
                    result[category].append({
                        "symbol": cols[0].get_text(strip=True).upper(),
                        "ltp": _parse_number(cols[1].get_text(strip=True)),
                        "change": _parse_number(cols[2].get_text(strip=True)),
                    })

        return result

    return await _CACHE.aget_or_set("sharehub:top", _loader, ttl=60)


async def get_market_summary() -> Dict[str, Any]:
    """Get market summary (index values) from ShareHub homepage."""

    async def _loader():
        html = await _fetch_page("/")
        if not html:
            return {}

        soup = BeautifulSoup(html, "lxml")
        summary: Dict[str, Any] = {"source": "sharehub"}

        index_section = soup.find(text=re.compile(r"NEPSE", re.I))
        if index_section:
            parent = index_section.find_parent(["div", "section", "tr"])
            if parent:
                numbers = re.findall(r"[\d,]+\.?\d*", parent.get_text())
                if numbers:
                    summary["nepse_index"] = _parse_number(numbers[0])
                    if len(numbers) > 1:
                        summary["change"] = _parse_number(numbers[1])

        return summary

    return await _CACHE.aget_or_set("sharehub:summary", _loader, ttl=60)


async def health() -> Dict[str, Any]:
    """Check ShareHub connectivity."""
    try:
        html = await _fetch_page("/", timeout=8.0)
        if html and len(html) > 500:
            return {"source": "sharehub", "status": "ok"}
        return {"source": "sharehub", "status": "degraded"}
    except Exception:
        return {"source": "sharehub", "status": "down"}
