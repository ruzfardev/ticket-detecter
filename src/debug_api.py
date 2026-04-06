"""
Debug script — calls API endpoints, saves raw JSON responses to data/debug/,
then compares with checker.py logic to find mismatches.
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(Path(__file__).parent))
load_dotenv(ROOT / ".env")

import requests
import auth

BASE_URL = "https://eticket.railway.uz"
DEBUG_DIR = ROOT / "data" / "debug"
DEBUG_DIR.mkdir(exist_ok=True)

auth.init(
    username=os.environ["RAILWAY_USERNAME"],
    password=os.environ["RAILWAY_PASSWORD"],
)


def save_json(name: str, data):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = DEBUG_DIR / f"{ts}_{name}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  Saved: {path.name}")
    return path


def debug_route(name: str, dep: str, arr: str, date: str, car_types: list[str]):
    print(f"\n{'='*60}")
    print(f"Route: {name} | Date: {date}")
    print(f"{'='*60}")

    headers = auth.get_auth_headers()

    # 1. Train list
    payload = {
        "directions": {
            "forward": {
                "date": date,
                "depStationCode": dep,
                "arvStationCode": arr,
            }
        }
    }

    print("\n--- Train List API ---")
    resp = requests.post(f"{BASE_URL}/api/v3/handbook/trains/list", json=payload, headers=headers, timeout=20)
    print(f"  Status: {resp.status_code}")
    raw = resp.json()
    save_json(f"trains_list_{name.replace(' ', '_')}_{date}", raw)

    # Analyze response structure
    data = raw.get("data", {})
    directions = data.get("directions", {})
    forward = directions.get("forward", {})
    trains = forward.get("trains", [])

    print(f"  Response keys: {list(raw.keys())}")
    print(f"  data keys: {list(data.keys())}")
    print(f"  directions keys: {list(directions.keys())}")
    print(f"  forward keys: {list(forward.keys())}")
    print(f"  Trains found: {len(trains)}")

    if not trains:
        print("  No trains in response.")
        # Show full forward content for debugging
        if forward:
            print(f"  Forward content: {json.dumps(forward, ensure_ascii=False)[:500]}")
        return

    for i, train in enumerate(trains):
        print(f"\n  Train #{i+1}: {train.get('number', '?')}")
        print(f"    Top-level keys: {list(train.keys())}")
        print(f"    brand: {train.get('brand')}")
        print(f"    departureDate: {train.get('departureDate')}")
        print(f"    arrivalDate: {train.get('arrivalDate')}")
        print(f"    timeOnWay: {train.get('timeOnWay')}")
        print(f"    trainId: {train.get('trainId')}")

        cars = train.get("cars", [])
        print(f"    Cars ({len(cars)}):")
        for c in cars:
            print(f"      type={c.get('type')!r} freeSeats={c.get('freeSeats')} keys={list(c.keys())}")

        sub = train.get("subRoute", {})
        if sub:
            print(f"    subRoute keys: {list(sub.keys())}")
            print(f"    depStation: {sub.get('depStationName')} arrStation: {sub.get('arvStationName')}")

        # Checker logic comparison
        total_free = sum(c.get("freeSeats", 0) for c in cars)
        car_type_list = [c.get("type", "").strip() for c in cars if c.get("type")]
        print(f"    → Checker sees: total_free={total_free}, car_types={car_type_list}")

        if car_types:
            normalized = [t.lower() for t in car_types]
            matched = [t for t in car_type_list if t.lower() in normalized]
            print(f"    → Filter ({car_types}): matched={matched}, would_skip={not matched}")

        # 2. Train detail
        print(f"\n    --- Detail API for {train.get('number')} ---")
        detail_payload = {
            "depDate": date,
            "depStationCode": dep,
            "arvStationCode": arr,
            "trainNumber": train.get("number"),
            "trainId": train.get("trainId"),
        }
        try:
            resp2 = requests.post(f"{BASE_URL}/api/v1/handbook/trains", json=detail_payload, headers=headers, timeout=20)
            print(f"    Status: {resp2.status_code}")
            detail_raw = resp2.json()
            save_json(f"train_detail_{train.get('number', 'unknown')}_{date}", detail_raw)

            detail_data = detail_raw.get("data", {})
            detail_train = detail_data.get("train", {})
            print(f"    detail.data keys: {list(detail_data.keys())}")
            print(f"    detail.train keys: {list(detail_train.keys())}")

            car_groups = detail_train.get("carGroup", [])
            print(f"    carGroups ({len(car_groups)}):")
            for g in car_groups:
                print(f"      typeShow={g.get('typeShow')!r} type={g.get('type')!r} keys={list(g.keys())}")
                for car in g.get("cars", []):
                    places = car.get("places") or []
                    print(f"        car #{car.get('number')}: {len(places)} places, keys={list(car.keys())}")
        except Exception as e:
            print(f"    Detail error: {e}")


def main():
    config = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))

    for route in config["routes"]:
        name = route["name"]
        dep = route["dep_station_code"]
        arr = route["arr_station_code"]
        car_types = route.get("car_types", [])

        # Get dates
        if "dates" in route:
            dates = route["dates"]
        else:
            from datetime import date as _date, timedelta
            d_from = _date.fromisoformat(route["date_from"])
            d_to = _date.fromisoformat(route["date_to"])
            dates = []
            current = d_from
            while current <= d_to:
                dates.append(current.isoformat())
                current += timedelta(days=1)

        for d in dates:
            try:
                debug_route(name, dep, arr, d, car_types)
            except Exception as e:
                print(f"\n  ERROR: {e}")


if __name__ == "__main__":
    main()