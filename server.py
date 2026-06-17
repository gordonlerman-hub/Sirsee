#!/usr/bin/env python3
"""Sirsee local dev server: static files + Chicagoland recommendations API."""

from __future__ import annotations

import json
import math
import os
import random
import re
import urllib.error
import urllib.parse
import urllib.request
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MERCHANTS_PATH = ROOT / "data" / "merchants.json"
VALID_REMINDER_FREQUENCIES = {"monthly", "quarterly", "biannual"}
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_dotenv()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
MERCHANTS_IMAGE_DIR = ROOT / "assets" / "merchants"
USER_AGENT = "Sirsee/1.0 (Chicagoland gift finder)"
CHICAGOLAND_BBOX = {
    "min_lat": 41.45,
    "max_lat": 42.65,
    "min_lng": -88.35,
    "max_lng": -87.35,
}
CHICAGOLAND_COUNTIES = {
    "cook county",
    "lake county",
    "dupage county",
    "kane county",
    "will county",
    "mchenry county",
}
NORTH_SHORE_PLACES = (
    "wilmette",
    "glenview",
    "winnetka",
    "highland park",
    "evanston",
    "kenilworth",
    "glencoe",
    "northbrook",
    "northfield",
    "lake forest",
    "highwood",
    "deerfield",
    "lincolnshire",
    "bannockburn",
    "riverwoods",
    "morton grove",
    "niles",
    "skokie",
)
LOCAL_DELIVERY_RADIUS_MILES = 7.0
PICK_POOL_SIZE = 8
SCORE_JITTER_RANGE = 12.0
OSM_LINK_FETCH_TIMEOUT = 5
OVERPASS_QUERY_TIMEOUT = 12
OVERPASS_RESULT_LIMIT = 40
LIKE_SHOP_TYPES = {
    "flowers": ["florist", "garden_centre"],
    "plants": ["florist", "garden_centre"],
    "sweets": ["bakery", "confectionery", "chocolate", "pastry"],
    "coffee": ["coffee", "tea"],
    "home": ["gift", "interior_decoration", "houseware"],
    "spa": ["cosmetics", "beauty"],
    "foodie": ["deli", "cheese", "gourmet", "chocolate", "confectionery"],
    "cozy": ["gift", "tea", "coffee"],
    "snacks": ["confectionery", "bakery", "chocolate"],
    "bar": ["alcohol", "wine"],
    "desk": ["houseware", "interior_decoration"],
}
SHOP_LIKES = {
    "florist": ["flowers", "plants"],
    "garden_centre": ["flowers", "plants"],
    "bakery": ["sweets", "snacks", "foodie"],
    "confectionery": ["sweets", "snacks"],
    "chocolate": ["sweets", "foodie"],
    "pastry": ["sweets", "foodie"],
    "coffee": ["coffee", "cozy"],
    "tea": ["coffee", "cozy"],
    "deli": ["foodie"],
    "cheese": ["foodie"],
    "gourmet": ["foodie"],
    "gift": ["home"],
    "interior_decoration": ["home", "cozy"],
    "houseware": ["home", "desk"],
    "cosmetics": ["spa"],
    "beauty": ["spa"],
    "alcohol": ["bar"],
    "wine": ["bar"],
}
BLOCKED_MERCHANT_TERMS = (
    "officedepot",
    "office depot",
    "staples",
    "walmart",
    "target",
    "amazon",
    "bestbuy",
    "best buy",
    "michaels",
    "hobbylobby",
    "hobby lobby",
    "walgreens",
    "cvs",
    "costco",
    "homedepot",
    "home depot",
    "lowes",
    "dollartree",
    "dollar tree",
    "fedexoffice",
    "fedex office",
    "upsstore",
    "theupsstore",
    "bedbathandbeyond",
    "tjmaxx",
    "marshalls",
    "kohls",
    "jcpenney",
    "macys",
    "fivebelow",
    "five below",
    "partycity",
    "party city",
)
LIKE_CATEGORIES = {
    "flowers": "Flowers",
    "plants": "Flowers",
    "sweets": "Sweets",
    "coffee": "Coffee/tea",
    "home": "Local goods",
    "spa": "Local goods",
    "foodie": "Sweets",
    "cozy": "Local goods",
    "snacks": "Sweets",
    "bar": "Bar & spirits",
    "desk": "Local goods",
}
LIKE_EXCLUDED_CATEGORIES = {
    "bar": {"Coffee/tea"},
}
MIN_CURATED_MATCHES = 2
CATEGORY_IMAGES = {
    "Flowers": "./assets/flowers.png",
    "Sweets": "./assets/bakery.png",
    "Coffee/tea": "./assets/tea.png",
    "Local goods": "./assets/candle.png",
    "Bar & spirits": "./assets/tea.png",
}
CATEGORY_DEFAULT_PRICES = {
    "Flowers": 48,
    "Sweets": 32,
    "Coffee/tea": 28,
    "Local goods": 35,
    "Bar & spirits": 45,
}

GEOCODE_CACHE: dict[str, dict] = {}
IMAGE_RESOLVE_CACHE: dict[str, str] = {}
LINK_VALIDATION_CACHE: dict[str, dict] = {}
GENERIC_IMAGES = set(CATEGORY_IMAGES.values())
BLOCKED_LINK_HOSTS = (
    "google.com/search",
    "facebook.com",
    "instagram.com",
    "yelp.com",
    "tripadvisor.com",
)
PARKED_LINK_PATTERNS = (
    re.compile(r"domain.*for sale", re.I),
    re.compile(r"buy this domain", re.I),
    re.compile(r"window\.location\.href\s*=\s*[\"']/lander", re.I),
    re.compile(r"hugedomains\.com", re.I),
    re.compile(r"godaddy\.com/forsale", re.I),
    re.compile(r"sedo\.com", re.I),
)
ORDER_PAGE_PATTERNS = (
    re.compile(r"add to cart", re.I),
    re.compile(r"add-to-cart", re.I),
    re.compile(r"/products/", re.I),
    re.compile(r"/collections/", re.I),
    re.compile(r"shop now", re.I),
    re.compile(r"order online", re.I),
    re.compile(r"shop flowers", re.I),
    re.compile(r"send flowers", re.I),
    re.compile(r"shopify", re.I),
    re.compile(r"eflorist", re.I),
    re.compile(r"bloomnation", re.I),
    re.compile(r"/cart\b", re.I),
    re.compile(r"/checkout\b", re.I),
    re.compile(r"toasttab", re.I),
    re.compile(r"square\.site", re.I),
    re.compile(r"woocommerce", re.I),
    re.compile(r"online shop", re.I),
)
PICKUP_ONLY_DELIVERY = re.compile(
    r"pickup only|in-store (?:pickup|shopping)(?: only)?|call ahead for large orders|"
    r"^local pickup(?: only)?[;.]|^in-store pickup[;.]",
    re.I,
)
ONLINE_DELIVERY_HINT = re.compile(
    r"online ordering|ships|shipping|delivery available|order online|local delivery|"
    r"same-day delivery|delivers|shop online|\bdelivery\b",
    re.I,
)
MERCHANT_VISUAL_OVERRIDES = {
    "katherine-anne-truffles": "./assets/likes/chocolate-pastries.png",
    "bennisons-bakery": "./assets/likes/chocolate-pastries.png",
    "wilmette-flowers": "./assets/likes/flowers-plants.png",
    "guild-glenview": "./assets/likes/home-goods.png",
    "wild-bloom-highland": "./assets/likes/flowers-plants.png",
    "millefiori": "./assets/likes/flowers-plants.png",
    "bookends-beginnings": "./assets/likes/cozy-night.png",
    "flowers-for-dreamers": "./assets/likes/flowers-plants.png",
    "toni-salemne": "./assets/likes/flowers-plants.png",
    "chalet-nursery": "./assets/likes/flowers-plants.png",
    "le-colonial-gifts": "./assets/likes/foodie-treats.png",
    "vermont-floral": "./assets/likes/flowers-plants.png",
}


def http_get_text(url: str, timeout: int = 15) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="ignore")


def fetch_link_page(url: str, timeout: int = 12) -> tuple[str, str] | None:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            final_url = response.geturl()
            html = response.read(120000).decode("utf-8", errors="ignore")
            return final_url, html
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return None


def is_blocked_link(url: str) -> bool:
    lowered = url.lower()
    return not lowered.startswith(("http://", "https://")) or any(host in lowered for host in BLOCKED_LINK_HOSTS)


def is_parked_link(final_url: str, html: str) -> bool:
    haystack = f"{final_url}\n{html[:12000]}"
    return any(pattern.search(haystack) for pattern in PARKED_LINK_PATTERNS)


def page_supports_online_order(html: str) -> bool:
    return any(pattern.search(html) for pattern in ORDER_PAGE_PATTERNS)


def delivery_supports_online_order(delivery: str) -> bool:
    delivery = delivery.strip()
    if not delivery:
        return False
    if PICKUP_ONLY_DELIVERY.search(delivery) and not ONLINE_DELIVERY_HINT.search(delivery):
        return False
    return bool(ONLINE_DELIVERY_HINT.search(delivery))


def qualify_order_link(item: dict) -> tuple[bool, str]:
    url = (item.get("link") or "").strip()
    if not url:
        return False, url

    cache_key = url
    if cache_key in LINK_VALIDATION_CACHE:
        cached = LINK_VALIDATION_CACHE[cache_key]
        return cached["ok"], cached["url"]

    if is_blocked_link(url):
        LINK_VALIDATION_CACHE[cache_key] = {"ok": False, "url": url}
        return False, url

    delivery = item.get("delivery", "")
    is_curated = item.get("source") == "curated"
    if is_curated and delivery_supports_online_order(delivery):
        LINK_VALIDATION_CACHE[cache_key] = {"ok": True, "url": url}
        return True, url
    if is_curated and not delivery_supports_online_order(delivery):
        LINK_VALIDATION_CACHE[cache_key] = {"ok": False, "url": url}
        return False, url

    fetch_timeout = OSM_LINK_FETCH_TIMEOUT
    fetched = fetch_link_page(url, timeout=fetch_timeout)
    if fetched:
        final_url, html = fetched
        if is_parked_link(final_url, html):
            LINK_VALIDATION_CACHE[cache_key] = {"ok": False, "url": final_url}
            return False, final_url

        if page_supports_online_order(html):
            LINK_VALIDATION_CACHE[cache_key] = {"ok": True, "url": final_url}
            return True, final_url

        LINK_VALIDATION_CACHE[cache_key] = {"ok": False, "url": final_url}
        return False, final_url

    LINK_VALIDATION_CACHE[cache_key] = {"ok": False, "url": url}
    return False, url


def filter_orderable_candidates(candidates: list[dict]) -> list[dict]:
    orderable: list[dict] = []
    for item in candidates:
        ok, resolved_url = qualify_order_link(item)
        if not ok:
            continue
        item["link"] = resolved_url
        orderable.append(item)
    return orderable


def target_delivery_zones(location: dict, zip_code: str) -> set[str]:
    zones = {"chicagoland"}
    place = location.get("place", "").lower()
    display = location.get("displayName", "").lower()
    haystack = f"{place} {display}"

    if zip_code.startswith(("606", "607")) or re.search(r"\bchicago\b", haystack):
        zones.add("chicago")

    if any(marker in haystack for marker in NORTH_SHORE_PLACES):
        zones.add("north_shore")

    if "chicago" not in zones or "north_shore" in zones:
        zones.add("chicago_metro")

    return zones


def infer_serves_zones(item: dict) -> set[str]:
    zones: set[str] = set()
    delivery = (item.get("delivery") or "").lower()
    tags = [tag.lower() for tag in item.get("tags") or []]
    neighborhood = (item.get("neighborhood") or "").lower()
    haystack = f"{delivery} {' '.join(tags)} {neighborhood}"

    if re.search(r"ships nationwide|nationwide|midwest shipping|ships from", delivery):
        zones.add("nationwide")
    if re.search(r"chicago delivery|same-day chicago|city of chicago", haystack):
        zones.add("chicago")
    if "north shore" in haystack:
        zones.add("north_shore")
    if re.search(r"chicago metro|nearby suburbs|suburbs", haystack):
        zones.add("chicago_metro")
    if re.search(r"ships from|online shop|online ordering", delivery) and "nationwide" not in zones:
        zones.add("nationwide")

    return zones


def merchant_serves_location(item: dict, target_zones: set[str]) -> bool:
    serves = set(item.get("servesZones") or infer_serves_zones(item))
    if "nationwide" in serves:
        return True
    if serves & target_zones:
        return True
    if item.get("source") == "openstreetmap":
        return item.get("distanceMiles", 99) <= LOCAL_DELIVERY_RADIUS_MILES
    return False


def filter_deliverable_candidates(candidates: list[dict], location: dict, zip_code: str) -> list[dict]:
    target_zones = target_delivery_zones(location, zip_code)
    return [item for item in candidates if merchant_serves_location(item, target_zones)]


def fetch_og_image(page_url: str) -> str | None:
    if not page_url or "google.com/search" in page_url:
        return None

    try:
        html = http_get_text(page_url, timeout=12)
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return None

    patterns = [
        r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image(?::secure_url)?["\']',
        r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            return urllib.parse.urljoin(page_url, match.group(1).strip())
    return None


def fetch_page_image(page_url: str) -> str | None:
    og_image = fetch_og_image(page_url)
    if og_image:
        return og_image

    try:
        html = http_get_text(page_url, timeout=12)
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return None

    patterns = [
        r"https://cdn\.shopify\.com/[^\"'\s>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\"'\s>]*)?",
        r"https://asset\.bloomnation\.com/[^\"'\s>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\"'\s>]*)?",
        r"https://[^\"'\s>]+wp-content/uploads/[^\"'\s>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\"'\s>]*)?",
        r"https://[^\"'\s>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\"'\s>]*)?",
    ]
    blocked = ("logo", "icon", "favicon", "sprite", "pixel", "avatar", "accent", "banner", "placeholder")
    for pattern in patterns:
        for match in re.finditer(pattern, html, re.IGNORECASE):
            candidate = match.group(0).split()[0]
            lowered = candidate.lower()
            if any(token in lowered for token in blocked):
                continue
            if "google.com" in lowered or "facebook.com" in lowered:
                continue
            return candidate
    return None


def cache_remote_image(merchant_id: str, image_url: str) -> str | None:
    MERCHANTS_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    safe_id = re.sub(r"[^a-z0-9-]+", "-", merchant_id.lower()).strip("-")
    destination = MERCHANTS_IMAGE_DIR / f"{safe_id}.jpg"

    try:
        request = urllib.request.Request(image_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=15) as response:
            content_type = response.headers.get("Content-Type", "")
            data = response.read()
            if "png" in content_type or image_url.lower().endswith(".png"):
                destination = MERCHANTS_IMAGE_DIR / f"{safe_id}.png"
            elif "webp" in content_type or image_url.lower().endswith(".webp"):
                destination = MERCHANTS_IMAGE_DIR / f"{safe_id}.webp"
            if len(data) < 1024:
                return None
            destination.write_bytes(data)
            return f"./assets/merchants/{destination.name}"
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return None


def local_merchant_image(merchant_id: str) -> str | None:
    safe_id = re.sub(r"[^a-z0-9-]+", "-", merchant_id.lower()).strip("-")
    for suffix in (".jpg", ".jpeg", ".png", ".webp"):
        path = MERCHANTS_IMAGE_DIR / f"{safe_id}{suffix}"
        if path.exists():
            return f"./assets/merchants/{path.name}"
    return None


def resolve_merchant_image(item: dict) -> str:
    merchant_id = item.get("id") or normalize_name(item["merchant"])
    cache_key = merchant_id
    if cache_key in IMAGE_RESOLVE_CACHE:
        return IMAGE_RESOLVE_CACHE[cache_key]

    local_image = local_merchant_image(merchant_id)
    if local_image:
        IMAGE_RESOLVE_CACHE[cache_key] = local_image
        return local_image

    image = item.get("imageUrl") or item.get("image", "")
    if image and image not in GENERIC_IMAGES:
        if image.startswith("http"):
            cached = cache_remote_image(merchant_id, image)
            if cached:
                IMAGE_RESOLVE_CACHE[cache_key] = cached
                return cached
        IMAGE_RESOLVE_CACHE[cache_key] = image
        return image

    page_image = fetch_page_image(item.get("link", ""))
    if page_image:
        cached = cache_remote_image(merchant_id, page_image)
        if cached:
            IMAGE_RESOLVE_CACHE[cache_key] = cached
            return cached

    fallback = (
        MERCHANT_VISUAL_OVERRIDES.get(merchant_id)
        or item.get("image")
        or CATEGORY_IMAGES.get(item.get("category", ""), "./assets/candle.png")
    )
    if fallback in GENERIC_IMAGES:
        fallback = MERCHANT_VISUAL_OVERRIDES.get(merchant_id, fallback)
    IMAGE_RESOLVE_CACHE[cache_key] = fallback
    return fallback


def load_merchants() -> list[dict]:
    with MERCHANTS_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def http_get_json(url: str, headers: dict | None = None, timeout: int = 20) -> dict | list:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def http_post_text(url: str, body: str, timeout: int = 30) -> str:
    data = body.encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8")


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 3958.8
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def geocode_zip(zip_code: str) -> dict:
    if zip_code in GEOCODE_CACHE:
        return GEOCODE_CACHE[zip_code]

    query = urllib.parse.urlencode(
        {"postalcode": zip_code, "country": "US", "format": "json", "limit": "1"}
    )
    results = http_get_json(f"https://nominatim.openstreetmap.org/search?{query}")
    if not results:
        raise ValueError("We could not find that ZIP code.")

    match = results[0]
    lat = float(match["lat"])
    lng = float(match["lon"])
    display = match.get("display_name", "")
    if not is_chicagoland(lat, lng, display):
        raise ValueError("Sirsee currently covers Chicagoland only. Try a Chicago-area ZIP like 60025 or 60614.")

    place = extract_place_name(display, zip_code)
    location = {"lat": lat, "lng": lng, "place": place, "displayName": display}
    GEOCODE_CACHE[zip_code] = location
    return location


def is_chicagoland(lat: float, lng: float, display_name: str) -> bool:
    in_bbox = (
        CHICAGOLAND_BBOX["min_lat"] <= lat <= CHICAGOLAND_BBOX["max_lat"]
        and CHICAGOLAND_BBOX["min_lng"] <= lng <= CHICAGOLAND_BBOX["max_lng"]
    )
    if not in_bbox:
        return False

    lowered = display_name.lower()
    if " illinois" in lowered or ", il" in lowered:
        return any(county in lowered for county in CHICAGOLAND_COUNTIES) or "chicago" in lowered
    return False


def extract_place_name(display_name: str, zip_code: str) -> str:
    parts = [part.strip() for part in display_name.split(",")]
    for part in parts:
        if part == zip_code:
            continue
        if part.endswith(" County") or part.endswith(" Township") or part in {"Illinois", "United States"}:
            continue
        if re.fullmatch(r"\d{5}", part):
            continue
        return part
    return "Chicagoland"


def shop_types_for_likes(likes: list[str]) -> list[str]:
    types: list[str] = []
    for like in likes:
        types.extend(LIKE_SHOP_TYPES.get(like, []))
    return sorted(set(types))


def query_overpass(lat: float, lng: float, shop_types: list[str], radius_m: int = 20000) -> list[dict]:
    if not shop_types:
        shop_types = ["florist", "bakery", "coffee", "gift", "confectionery"]

    regex = "|".join(re.escape(value) for value in shop_types)
    query = f"""
    [out:json][timeout:{OVERPASS_QUERY_TIMEOUT}];
    (
      node["shop"~"{regex}"](around:{radius_m},{lat},{lng});
      way["shop"~"{regex}"](around:{radius_m},{lat},{lng});
    );
    out center {OVERPASS_RESULT_LIMIT};
    """
    try:
        payload = json.loads(
            http_post_text(
                "https://overpass-api.de/api/interpreter",
                urllib.parse.urlencode({"data": query}),
                timeout=OVERPASS_QUERY_TIMEOUT + 3,
            )
        )
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError, OSError):
        return []

    results = []
    for element in payload.get("elements", []):
        tags = element.get("tags", {})
        name = tags.get("name")
        if not name:
            continue

        shop = tags.get("shop", "gift")
        if element.get("type") == "node":
            shop_lat = element.get("lat")
            shop_lng = element.get("lon")
        else:
            center = element.get("center") or {}
            shop_lat = center.get("lat")
            shop_lng = center.get("lon")

        if shop_lat is None or shop_lng is None:
            continue

        website = tags.get("website") or tags.get("contact:website")
        if not website:
            continue

        results.append(
            {
                "id": f"osm-{element.get('type')}-{element.get('id')}",
                "merchant": name,
                "name": gift_name_for_shop(name, shop),
                "neighborhood": tags.get("addr:city") or "Nearby",
                "lat": float(shop_lat),
                "lng": float(shop_lng),
                "price": CATEGORY_DEFAULT_PRICES.get(category_for_shop(shop), 35),
                "category": category_for_shop(shop),
                "image": CATEGORY_IMAGES.get(category_for_shop(shop), "./assets/candle.png"),
                "link": website,
                "delivery": "Check the merchant for local pickup or delivery options",
                "tags": ["local", "openstreetmap", shop.replace("_", " ")],
                "likes": likes_for_shop(shop),
                "reason": "it is a real nearby Chicagoland shop surfaced from local map data, so the pick stays grounded in your area.",
                "source": "openstreetmap",
            }
        )
    return results


def category_for_shop(shop: str) -> str:
    if shop in {"florist", "garden_centre"}:
        return "Flowers"
    if shop in {"bakery", "confectionery", "chocolate", "pastry"}:
        return "Sweets"
    if shop in {"coffee", "tea"}:
        return "Coffee/tea"
    if shop in {"alcohol", "wine"}:
        return "Bar & spirits"
    return "Local goods"


def likes_for_shop(shop: str) -> list[str]:
    return list(SHOP_LIKES.get(shop, []))


def gift_name_for_shop(merchant: str, shop: str) -> str:
    labels = {
        "florist": "Seasonal fresh arrangement",
        "garden_centre": "Plant or planter gift",
        "bakery": "Pastry or treat gift box",
        "confectionery": "Sweet treat assortment",
        "chocolate": "Chocolate gift box",
        "coffee": "Coffee beans or gift set",
        "tea": "Tea gift set",
        "gift": "Curated gift pick",
    }
    return labels.get(shop, f"Gift pick from {merchant}")


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def is_blocked_merchant(name: str) -> bool:
    normalized = normalize_name(name)
    if not normalized:
        return True
    return any(term in normalized for term in BLOCKED_MERCHANT_TERMS)


def filter_confident_candidates(candidates: list[dict], likes: list[str]) -> list[dict]:
    confident: list[dict] = []
    for item in candidates:
        if is_blocked_merchant(item.get("merchant", "")):
            continue
        if likes and not set(item.get("likes") or []).intersection(likes):
            continue
        excluded = set()
        for like in likes:
            excluded.update(LIKE_EXCLUDED_CATEGORIES.get(like, set()))
        if excluded and item.get("category") in excluded:
            continue
        confident.append(item)
    return confident


def filter_by_budget(candidates: list[dict], budget: float) -> list[dict]:
    return [item for item in candidates if item["price"] <= budget]


def merge_candidates(curated: list[dict], discovered: list[dict]) -> list[dict]:
    merged = []
    seen = set()

    for item in curated + discovered:
        key = normalize_name(item["merchant"])
        if key in seen:
            continue
        seen.add(key)
        merged.append(item)
    return merged


def score_gift(gift: dict, brief: dict, location: dict) -> float:
    budget = float(brief.get("budget") or 50)
    likes = brief.get("likes") or []
    custom_like = (brief.get("customLike") or "").lower()
    distance = gift.get("distanceMiles", 99)

    score = 100.0 if gift["price"] <= budget else max(0.0, 85.0 - (gift["price"] - budget) * 8.0)

    gift_likes = set(gift.get("likes") or [])
    if gift_likes.intersection(likes):
        score += 40.0

    if likes:
        category_match = any(LIKE_CATEGORIES.get(like) == gift.get("category") for like in likes)
        if category_match:
            score += 28.0
        else:
            score -= 30.0

    if gift["category"] == "Flowers" and re.search(r"flower|bouquet|plant", custom_like):
        score += 20.0
    if gift["category"] == "Sweets" and re.search(r"chocolate|pastr|bakery|sweet|dessert", custom_like):
        score += 20.0
    if gift["category"] == "Coffee/tea" and re.search(r"coffee|tea|matcha|chai", custom_like):
        score += 20.0
    if gift["category"] == "Bar & spirits" and re.search(r"bar|wine|spirit|cocktail|whiskey|bourbon", custom_like):
        score += 20.0
    if gift["category"] == "Local goods" and re.search(r"candle|home|ceramic|skincare|desk", custom_like):
        score += 20.0

    if any("delivery" in tag or tag in {"delivery", "ships"} for tag in gift.get("tags", [])):
        score += 12.0

    if gift.get("source") == "curated":
        score += 6.0

    score += max(0.0, 24.0 - distance * 1.8)
    return score


def gift_matches_like(gift: dict, like: str) -> bool:
    return like in (gift.get("likes") or [])


def gift_matches_any_like(gift: dict, likes: list[str]) -> bool:
    return any(gift_matches_like(gift, like) for like in likes)


def score_with_variation(gift: dict, brief: dict, location: dict) -> float:
    base = score_gift(gift, brief, location)
    jitter = random.uniform(-SCORE_JITTER_RANGE, SCORE_JITTER_RANGE)
    return round(base + jitter, 2)


def candidates_for_like(available: list[dict], like: str, used_ids: set[str]) -> list[dict]:
    return [
        item
        for item in available
        if item["id"] not in used_ids and like in (item.get("likes") or [])
    ]


def weighted_choice(items: list[dict], top_k: int = PICK_POOL_SIZE) -> dict | None:
    if not items:
        return None

    pool = sorted(
        items,
        key=lambda item: (-item.get("score", 0), item.get("distanceMiles", 99), item["price"]),
    )[:top_k]
    return pool[0]


def pick_for_like(available: list[dict], like: str, used_ids: set[str]) -> dict | None:
    return weighted_choice(candidates_for_like(available, like, used_ids))


def weighted_fill_picks(
    available: list[dict],
    used_ids: set[str],
    target_count: int,
    predicate,
) -> list[dict]:
    picks: list[dict] = []
    while len(picks) < target_count:
        pool = [item for item in available if item["id"] not in used_ids and predicate(item)]
        choice = weighted_choice(pool)
        if not choice:
            break
        picks.append(choice)
        used_ids.add(choice["id"])
    return picks


def select_picks(available: list[dict], likes: list[str], target_count: int = 3) -> list[dict]:
    if not available:
        return []

    if not likes:
        return []

    picks: list[dict] = []
    used_ids: set[str] = set()

    for like in likes:
        if len(picks) >= target_count:
            break
        item = pick_for_like(available, like, used_ids)
        if item:
            picks.append({**item, "matchedLike": like})
            used_ids.add(item["id"])

    for item in weighted_fill_picks(
        available,
        used_ids,
        target_count - len(picks),
        lambda candidate: gift_matches_any_like(candidate, likes),
    ):
        matched_like = next(like for like in likes if gift_matches_like(item, like))
        picks.append({**item, "matchedLike": matched_like})
        used_ids.add(item["id"])

    picks.sort(key=lambda item: (-item["score"], item["distanceMiles"], item["price"]))
    return picks[:target_count]


def select_picks_with_curated_priority(
    available: list[dict],
    likes: list[str],
    target_count: int = 3,
) -> list[dict]:
    curated = [item for item in available if item.get("source") == "curated"]
    discovered = [item for item in available if item.get("source") != "curated"]

    picks = select_picks(curated, likes, target_count=target_count)
    if len(picks) >= target_count or not discovered:
        return picks

    used_ids = {item["id"] for item in picks}
    remaining = [item for item in discovered if item["id"] not in used_ids]
    extra = select_picks(remaining, likes, target_count=target_count - len(picks))
    return picks + extra


def load_curated_candidates(location: dict) -> list[dict]:
    curated: list[dict] = []
    for merchant in load_merchants():
        item = dict(merchant)
        item["distanceMiles"] = round(
            haversine_miles(location["lat"], location["lng"], item["lat"], item["lng"]),
            1,
        )
        item["source"] = "curated"
        curated.append(item)
    return curated


def prepare_budget_pool(
    items: list[dict],
    brief: dict,
    location: dict,
    zip_code: str,
    likes: list[str],
    budget: float,
) -> tuple[list[dict], list[dict]]:
    orderable = filter_orderable_candidates(items)
    candidates = filter_deliverable_candidates(orderable, location, zip_code)
    if not candidates:
        return [], []

    for item in candidates:
        item["score"] = score_with_variation(item, brief, location)
        item["overBudget"] = max(0, item["price"] - budget)

    ranked = sorted(candidates, key=lambda item: (-item["score"], item["distanceMiles"], item["price"]))
    confident = filter_confident_candidates(ranked, likes)
    return confident, filter_by_budget(confident, budget)


def merge_budget_pools(*pools: list[dict]) -> list[dict]:
    merged: list[dict] = []
    seen: set[str] = set()
    for pool in pools:
        for item in pool:
            if item["id"] in seen:
                continue
            seen.add(item["id"])
            merged.append(item)
    return merged


def build_recommendations(brief: dict) -> dict:
    zip_code = str(brief.get("zipCode", "")).strip()
    if not re.fullmatch(r"\d{5}", zip_code):
        raise ValueError("Enter a valid 5-digit Chicagoland ZIP code.")

    location = geocode_zip(zip_code)
    likes = brief.get("likes") or []
    budget = float(brief.get("budget") or 50)
    exclude_ids = set(brief.get("excludeIds") or [])
    target_count = max(3, len(likes)) if likes else 0

    curated = load_curated_candidates(location)
    confident, budget_fit = prepare_budget_pool(curated, brief, location, zip_code, likes, budget)

    if not confident:
        raise ValueError(
            "No local gift shops with online ordering to this ZIP matched this brief yet. Try adjusting likes or budget."
        )
    if not budget_fit:
        raise ValueError(
            f"No local gift shops matched this brief within your ${int(budget)} budget. Try a higher budget or fewer likes."
        )

    available = [item for item in budget_fit if item["id"] not in exclude_ids]
    picks = select_picks_with_curated_priority(available, likes, target_count=target_count)

    all_budget_fit = list(budget_fit)
    if len(picks) < target_count:
        discovered = query_overpass(location["lat"], location["lng"], shop_types_for_likes(likes))
        for item in discovered:
            item["distanceMiles"] = round(
                haversine_miles(location["lat"], location["lng"], item["lat"], item["lng"]),
                1,
            )
            item["source"] = "openstreetmap"

        _, osm_budget_fit = prepare_budget_pool(discovered, brief, location, zip_code, likes, budget)
        all_budget_fit = merge_budget_pools(budget_fit, osm_budget_fit)
        used_ids = {item["id"] for item in picks}
        available_osm = [
            item
            for item in osm_budget_fit
            if item["id"] not in exclude_ids and item["id"] not in used_ids
        ]
        picks.extend(select_picks_with_curated_priority(available_osm, likes, target_count=target_count - len(picks)))

    if not picks:
        if budget_fit and exclude_ids:
            raise ValueError(
                "No more gift ideas within your budget and likes. Try editing your brief or raising your budget."
            )
        raise ValueError(
            "We couldn't find gift shops we're confident match this brief. Try different likes or a higher budget."
        )

    for item in picks:
        item["image"] = resolve_merchant_image(item)

    pick_ids = {item["id"] for item in picks}
    remaining_ids = {
        item["id"] for item in all_budget_fit if item["id"] not in exclude_ids and item["id"] not in pick_ids
    }
    has_more = len(remaining_ids) > 0

    return {
        "location": {
            "zipCode": zip_code,
            "place": location["place"],
            "lat": location["lat"],
            "lng": location["lng"],
        },
        "gifts": picks,
        "hasMore": has_more,
    }


def validate_email(value: str) -> str:
    email = value.strip()
    if not email or not EMAIL_PATTERN.match(email):
        raise ValueError("Enter a valid email address.")
    return email


def validate_reminder_frequency(value: str) -> str:
    frequency = (value or "").strip().lower()
    if frequency not in VALID_REMINDER_FREQUENCIES:
        raise ValueError("Choose a reminder frequency.")
    return frequency


def require_supabase() -> None:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise ValueError("Sign-in is not configured yet. Add Supabase credentials to .env.")


def supabase_rest(
    method: str,
    resource: str,
    token: str,
    *,
    query: dict | None = None,
    body: dict | list | None = None,
    prefer: str | None = None,
) -> tuple[int, dict | list | None, dict[str, str]]:
    require_supabase()
    params = urllib.parse.urlencode(query or {}, doseq=True)
    url = f"{SUPABASE_URL}/rest/v1/{resource}"
    if params:
        url = f"{url}?{params}"

    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": SUPABASE_ANON_KEY,
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer

    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            payload = json.loads(raw) if raw else None
            return response.status, payload, dict(response.headers)
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="ignore")
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = None
        if error.code in {401, 403}:
            raise ValueError("Your session expired. Sign in again.") from error
        message = None
        if isinstance(payload, dict):
            message = payload.get("message") or payload.get("error")
        raise ValueError(message or "Could not reach Supabase. Try again.") from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise ValueError("Could not reach Supabase. Try again.") from error


def reminder_from_row(row: dict) -> dict:
    created_at = row.get("created_at") or ""
    updated_at = row.get("updated_at") or ""
    return {
        "userId": row["user_id"],
        "recipientName": row["recipient_name"],
        "email": row["email"],
        "frequency": row["frequency"],
        "recipientGender": row["recipient_gender"],
        "budget": row["budget"],
        "zipCode": row["zip_code"],
        "likes": row.get("likes") or [],
        "customLike": row.get("custom_like") or "",
        "likesSummary": row.get("likes_summary") or "",
        "createdAt": created_at.replace("+00:00", "Z") if isinstance(created_at, str) else created_at,
        "updatedAt": updated_at.replace("+00:00", "Z") if isinstance(updated_at, str) else updated_at,
    }


def reminder_to_row(reminder: dict, *, created_at: str | None = None) -> dict:
    row = {
        "user_id": reminder["userId"],
        "recipient_name": reminder["recipientName"],
        "email": reminder["email"],
        "frequency": reminder["frequency"],
        "recipient_gender": reminder["recipientGender"],
        "budget": reminder["budget"],
        "zip_code": reminder["zipCode"],
        "likes": reminder["likes"],
        "custom_like": reminder["customLike"],
        "likes_summary": reminder["likesSummary"],
    }
    if created_at:
        row["created_at"] = created_at
    return row


def verify_access_token(token: str) -> dict:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise ValueError("Sign-in is not configured yet. Add Supabase credentials to .env.")

    request = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": SUPABASE_ANON_KEY,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        if error.code in {401, 403}:
            raise ValueError("Your session expired. Sign in again.") from error
        raise ValueError("Could not verify your sign-in. Try again.") from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise ValueError("Could not verify your sign-in. Try again.") from error

    user_id = payload.get("id")
    email = payload.get("email")
    if not user_id or not email:
        raise ValueError("Could not verify your sign-in. Try again.")
    return {"id": user_id, "email": email}


def authenticate_request(handler: SimpleHTTPRequestHandler) -> tuple[dict, str]:
    auth_header = handler.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise ValueError("Sign in to manage email reminders.")
    token = auth_header[7:].strip()
    return verify_access_token(token), token


def sanitize_reminder(raw: dict, user: dict) -> dict:
    recipient_name = (raw.get("recipientName") or "").strip()
    if not recipient_name:
        raise ValueError("Add a recipient name before setting a reminder.")

    email = validate_email(user.get("email") or "")
    frequency = validate_reminder_frequency(raw.get("frequency") or "")
    likes = raw.get("likes") or []
    if not isinstance(likes, list):
        raise ValueError("Reminder likes must be a list.")

    budget = raw.get("budget")
    try:
        budget = int(budget)
    except (TypeError, ValueError):
        raise ValueError("Reminder budget must be a number.") from None
    if budget < 1:
        raise ValueError("Reminder budget must be at least $1.")

    zip_code = re.sub(r"\D", "", str(raw.get("zipCode") or ""))[:5]
    if len(zip_code) != 5:
        raise ValueError("Reminder ZIP code must be 5 digits.")

    recipient_gender = (raw.get("recipientGender") or "female").strip().lower()
    if recipient_gender not in {"female", "male"}:
        recipient_gender = "female"

    custom_like = str(raw.get("customLike") or "").strip()
    likes_summary = str(raw.get("likesSummary") or "").strip()

    return {
        "userId": user["id"],
        "recipientName": recipient_name,
        "email": email,
        "frequency": frequency,
        "recipientGender": recipient_gender,
        "budget": budget,
        "zipCode": zip_code,
        "likes": [str(like).strip() for like in likes if str(like).strip()],
        "customLike": custom_like,
        "likesSummary": likes_summary,
    }


def postgrest_eq(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'eq."{escaped}"'


def find_reminder_row(token: str, recipient_name: str) -> dict | None:
    _, payload, _ = supabase_rest(
        "GET",
        "reminders",
        token,
        query={
            "select": "*",
            "recipient_name": postgrest_eq(recipient_name.strip()),
            "limit": "1",
        },
    )
    if not isinstance(payload, list) or not payload:
        return None
    return payload[0]


def list_reminders_for_user(token: str) -> list[dict]:
    _, payload, _ = supabase_rest(
        "GET",
        "reminders",
        token,
        query={"select": "*", "order": "updated_at.desc"},
    )
    if not isinstance(payload, list):
        return []
    return [reminder_from_row(row) for row in payload]


def upsert_reminder(raw: dict, user: dict, token: str) -> dict:
    reminder = sanitize_reminder(raw, user)
    existing = find_reminder_row(token, reminder["recipientName"])
    row = reminder_to_row(
        reminder,
        created_at=existing.get("created_at") if existing else None,
    )
    _, payload, _ = supabase_rest(
        "POST",
        "reminders",
        token,
        query={"on_conflict": "user_id,recipient_name"},
        body=row,
        prefer="return=representation,resolution=merge-duplicates",
    )
    if not isinstance(payload, list) or not payload:
        raise ValueError("Could not save your reminder. Try again.")
    return reminder_from_row(payload[0])


def delete_reminder(token: str, recipient_name: str) -> bool:
    recipient_name = recipient_name.strip()
    if not recipient_name:
        raise ValueError("Recipient name is required.")

    _, _, headers = supabase_rest(
        "DELETE",
        "reminders",
        token,
        query={"recipient_name": postgrest_eq(recipient_name)},
        prefer="count=exact",
    )
    content_range = headers.get("Content-Range") or headers.get("content-range") or ""
    if "/" not in content_range:
        return False
    try:
        return int(content_range.rsplit("/", 1)[-1]) > 0
    except ValueError:
        return False


class SirseeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/api/config":
            self._handle_config()
            return
        if self.path == "/api/reminders":
            self._handle_list_reminders()
            return
        super().do_GET()

    def do_DELETE(self) -> None:
        if self.path != "/api/reminders":
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return

        length = int(self.headers.get("Content-Length", "0"))
        try:
            user, token = authenticate_request(self)
            body = json.loads(self.rfile.read(length).decode("utf-8") if length else "{}")
            recipient_name = (body.get("recipientName") or "").strip()
            if not recipient_name:
                raise ValueError("Recipient name is required.")
            removed = delete_reminder(token, recipient_name)
            if not removed:
                self._send_json({"error": "Reminder not found."}, status=HTTPStatus.NOT_FOUND)
                return
            self._send_json({"ok": True})
        except ValueError as error:
            self._send_json({"error": str(error)}, status=HTTPStatus.BAD_REQUEST)
        except json.JSONDecodeError:
            self._send_json({"error": "Invalid JSON body."}, status=HTTPStatus.BAD_REQUEST)

    def do_POST(self) -> None:
        if self.path == "/api/recommendations":
            self._handle_recommendations()
            return
        if self.path == "/api/reminders":
            self._handle_save_reminder()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def _handle_config(self) -> None:
        self._send_json(
            {
                "supabaseUrl": SUPABASE_URL or None,
                "supabaseAnonKey": SUPABASE_ANON_KEY or None,
            }
        )

    def _handle_list_reminders(self) -> None:
        try:
            _user, token = authenticate_request(self)
            reminders = list_reminders_for_user(token)
            self._send_json({"reminders": reminders})
        except ValueError as error:
            self._send_json({"error": str(error)}, status=HTTPStatus.BAD_REQUEST)

    def _handle_save_reminder(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        try:
            user, token = authenticate_request(self)
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            reminder = upsert_reminder(body, user, token)
            self._send_json({"reminder": reminder})
        except ValueError as error:
            self._send_json({"error": str(error)}, status=HTTPStatus.BAD_REQUEST)
        except json.JSONDecodeError:
            self._send_json({"error": "Invalid JSON body."}, status=HTTPStatus.BAD_REQUEST)

    def _handle_recommendations(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            payload = build_recommendations(body)
            self._send_json(payload)
        except ValueError as error:
            self._send_json({"error": str(error)}, status=HTTPStatus.BAD_REQUEST)
        except Exception:
            self._send_json(
                {"error": "Something went wrong fetching local shops. Try again in a moment."},
                status=HTTPStatus.BAD_GATEWAY,
            )

    def _send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format: str, *args) -> None:
        if str(args[0]).startswith("2"):
            super().log_message(format, *args)


def main() -> None:
    port = int(os.environ.get("PORT", "4174"))
    server = ThreadingHTTPServer(("127.0.0.1", port), SirseeHandler)
    print(f"Sirsee server running at http://127.0.0.1:{port}")
    print("Recommendations API: POST /api/recommendations")
    print("Reminders API: GET/POST/DELETE /api/reminders")
    server.serve_forever()


if __name__ == "__main__":
    main()
