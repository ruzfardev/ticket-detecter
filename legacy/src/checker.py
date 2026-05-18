import time
from dataclasses import dataclass, field
from typing import Optional
import requests
from auth import get_auth_headers

BASE_URL = "https://eticket.railway.uz"
TRAINS_LIST_ENDPOINT = f"{BASE_URL}/api/v3/handbook/trains/list"
TRAIN_DETAIL_ENDPOINT = f"{BASE_URL}/api/v1/handbook/trains"

# Normalize car type names across languages (API returns uz/ru/mixed)
CAR_TYPE_MAP = {
    "plaskartli": "плацкарта",
    "плацкартный": "плацкарта",
    "плацкарта": "плацкарта",
    "kupe": "купе",
    "купе": "купе",
    "lyuks": "люкс",
    "люкс": "люкс",
    "sv": "св",
    "св": "св",
    "sidyachiy": "сидячий",
    "сидячий": "сидячий",
}


def _normalize_car_type(raw: str) -> str:
    return CAR_TYPE_MAP.get(raw.strip().lower(), raw.strip().lower())


@dataclass
class CarDetail:
    number: str
    type: str
    free_seats: int
    places: list[int]


@dataclass
class AvailableTrain:
    number: str
    brand: str
    departure: str
    arrival: str
    time_on_way: str
    dep_station: str
    arr_station: str
    car_types: list[str]
    total_free: int
    train_id: Optional[str]
    cars_detail: list[CarDetail] = field(default_factory=list)


def _fetch_train_detail(
    dep_date: str,
    dep_station_code: str,
    arr_station_code: str,
    train_number: str,
    train_id: Optional[str],
    allowed_car_types: Optional[list[str]] = None,
) -> list[CarDetail]:
    payload = {
        "depDate": dep_date,
        "depStationCode": dep_station_code,
        "arvStationCode": arr_station_code,
        "trainNumber": train_number,
        "trainId": train_id,
    }
    resp = requests.post(
        TRAIN_DETAIL_ENDPOINT,
        json=payload,
        headers=get_auth_headers(),
        timeout=20,
    )
    resp.raise_for_status()

    car_groups = resp.json().get("data", {}).get("train", {}).get("carGroup", [])
    result = []
    normalized_filter = [_normalize_car_type(t) for t in allowed_car_types] if allowed_car_types else None
    for group in car_groups:
        car_type = _normalize_car_type(group.get("typeShow") or group.get("type", ""))
        if normalized_filter and car_type not in normalized_filter:
            continue
        for car in group.get("cars", []):
            places = car.get("places") or []
            result.append(CarDetail(
                number=str(car.get("number", "")),
                type=car_type,
                free_seats=len(places),
                places=places,
            ))
    return result


def check_tickets(
    dep_station_code: str,
    arr_station_code: str,
    date: str,
    allowed_car_types: Optional[list[str]] = None,
) -> list[AvailableTrain]:
    payload = {
        "directions": {
            "forward": {
                "date": date,
                "depStationCode": dep_station_code,
                "arvStationCode": arr_station_code,
            }
        }
    }

    resp = requests.post(TRAINS_LIST_ENDPOINT, json=payload, headers=get_auth_headers(), timeout=20)
    resp.raise_for_status()

    trains = resp.json().get("data", {}).get("directions", {}).get("forward", {}).get("trains", [])

    available = []
    for train in trains:
        cars = train.get("cars", [])
        if not cars:
            continue

        car_entries = [(c, _normalize_car_type(c.get("type", ""))) for c in cars if c.get("type")]

        if allowed_car_types:
            normalized = [_normalize_car_type(t) for t in allowed_car_types]
            car_entries = [(c, t) for c, t in car_entries if t in normalized]
            if not car_entries:
                continue

        car_types = [t for _, t in car_entries]
        total_free = sum(c.get("freeSeats", 0) for c, _ in car_entries)

        sub = train.get("subRoute", {})
        available.append(AvailableTrain(
            number=train.get("number", ""),
            brand=train.get("brand", ""),
            departure=train.get("departureDate", ""),
            arrival=train.get("arrivalDate", ""),
            time_on_way=train.get("timeOnWay", ""),
            dep_station=sub.get("depStationName", ""),
            arr_station=sub.get("arvStationName", ""),
            car_types=car_types,
            total_free=total_free,
            train_id=train.get("trainId"),
        ))

    # Fetch detail for each available train (with delay to avoid ban)
    dep_date = date  # already "YYYY-MM-DD"
    for i, train in enumerate(available):
        if i > 0:
            time.sleep(1)
        try:
            train.cars_detail = _fetch_train_detail(
                dep_date, dep_station_code, arr_station_code,
                train.number, train.train_id, allowed_car_types,
            )
        except Exception as e:
            print(f"[checker] Detail fetch failed for {train.number}: {e}")

    return available
