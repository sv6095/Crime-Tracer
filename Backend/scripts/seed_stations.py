# scripts/seed_stations.py
"""
One-time script to seed Dakshina Kannada police stations.

Run with:
    python -m scripts.seed_stations
from project root (where app/ lives).
"""

from app.db import SessionLocal
from app import models

DK_STATIONS = [
  { "id": "barke-police-station", "name": "Barke Police Station" },
  { "id": "pandeshwar-police-station", "name": "Pandeshwar Police Station" },
  { "id": "mangalore-east-police-station", "name": "Mangaluru East Police Station" },
  { "id": "mangalore-north-police-station", "name": "Mangaluru North Police Station" },
  { "id": "urwa-police-station", "name": "Urwa Police Station" },
  { "id": "kadri-police-station", "name": "Kadri Police Station" },
  { "id": "kankanady-town-police-station", "name": "Kankanady Town Police Station" },
  { "id": "kankanady-rural-police-station", "name": "Kankanady Rural Police Station" },
  { "id": "mangalore-women-police-station", "name": "Mangaluru Women Police Station" },
  { "id": "traffic-east-police-station", "name": "Traffic East Police Station" },
  { "id": "traffic-west-police-station", "name": "Traffic West Police Station" },
  { "id": "cyber-police-station-mangalore", "name": "Cyber Crime Police Station - Mangaluru" },
  { "id": "economic-offences-police-station", "name": "Economic Offences & Narcotics Police Station" },
  { "id": "bajpe-police-station", "name": "Bajpe Police Station" },
  { "id": "kaup-police-station", "name": "Kaup Police Station" },
  { "id": "mulki-police-station", "name": "Mulki Police Station" },
  { "id": "surathkal-police-station", "name": "Surathkal Police Station" },
  { "id": "moodbidri-police-station", "name": "Moodbidri Police Station" },
  { "id": "vamanjoor-police-station", "name": "Vamanjoor Police Station" },
  { "id": "kinnigoli-police-station", "name": "Kinnigoli Police Station" },
  { "id": "bantwal-town-police-station", "name": "Bantwal Town Police Station" },
  { "id": "bantwal-rural-police-station", "name": "Bantwal Rural Police Station" },
  { "id": "panemangalore-police-station", "name": "Panemangalore Police Station" },
  { "id": "vitla-police-station", "name": "Vitla Police Station" },
  { "id": "kowdoor-police-station", "name": "Kowdoor Police Station" },
  { "id": "narimogaru-police-station", "name": "Narimogaru Police Station" },
  { "id": "belthangady-police-station", "name": "Belthangady Police Station" },
  { "id": "dharmasthala-police-station", "name": "Dharmasthala Police Station" },
  { "id": "venur-police-station", "name": "Venur Police Station" },
  { "id": "ujire-police-station", "name": "Ujire Police Station" },
  { "id": "puttur-town-police-station", "name": "Puttur Town Police Station" },
  { "id": "puttur-rural-police-station", "name": "Puttur Rural Police Station" },
  { "id": "sullia-police-station", "name": "Sullia Police Station" },
  { "id": "kadaba-police-station", "name": "Kadaba Police Station" },
  { "id": "subramanya-police-station", "name": "Subramanya Police Station" },
  { "id": "bellare-police-station", "name": "Bellare Police Station" },
  { "id": "jalsoor-police-station", "name": "Jalsoor Police Station" },
  { "id": "aranthodu-police-station", "name": "Aranthodu Police Station" }
]



# id generation not needed anymore, we use hardcoded IDs
# def generate_station_id(name: str) -> str:
#     return f"ps_{name.lower().replace(' ', '_').replace('.', '')}"[:60]

def main():
    db = SessionLocal()
    try:
        existing = {s.id for s in db.query(models.Station).all()}
        created = 0
        for st in DK_STATIONS:
            if st["id"] in existing:
                continue
            
            station = models.Station(
                id=st["id"],
                name=st["name"],
                address="Mangaluru", # default placeholder as not provided in frontend constants
                jurisdiction="Mangaluru", # default placeholder
            )
            db.add(station)
            created += 1
        db.commit()
        print(f"Seeded {created} new stations.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
