import time
from dataclasses import dataclass, field
from typing import Optional
import requests
from auth import get_auth_headers

BASE_URL = "https://eticket.railway.uz"
TRAINS_LIST_ENDPOINT = f"{BASE_URL}/api/v3/handbook/trains/list"
TRAIN_DETAIL_ENDPOINT = f"{BASE_URL}/api/v1/handbook/trains"


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
    for group in car_groups:
        car_type = group.get("typeShow") or group.get("type", "")
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

        car_types = [c.get("type", "").strip() for c in cars if c.get("type")]
        total_free = sum(c.get("freeSeats", 0) for c in cars)

        if allowed_car_types:
            normalized = [t.lower() for t in allowed_car_types]
            matched = [t for t in car_types if t.lower() in normalized]
            if not matched:
                continue
            car_types = matched

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
                train.number, train.train_id,
            )
        except Exception as e:
            print(f"[checker] Detail fetch failed for {train.number}: {e}")

    return available
