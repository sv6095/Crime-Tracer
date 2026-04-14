// src/constants/stations.ts
// Centralized DK police station constants and Station type

export interface Station {
  id: string;            // stable machine id (used as value)
  name: string;          // human readable name (primary)
  station_name?: string; // optional alias many of your components expect
  address?: string;
  lat?: number;
  lng?: number;
}

export const DK_POLICE_STATIONS: Station[] = [
  { id: "barke-police-station", name: "Barke Police Station", station_name: "Barke Police Station" },
  { id: "pandeshwar-police-station", name: "Pandeshwar Police Station", station_name: "Pandeshwar Police Station" },
  { id: "mangalore-east-police-station", name: "Mangaluru East Police Station", station_name: "Mangaluru East Police Station" },
  { id: "mangalore-north-police-station", name: "Mangaluru North Police Station", station_name: "Mangaluru North Police Station" },
  { id: "urwa-police-station", name: "Urwa Police Station", station_name: "Urwa Police Station" },
  { id: "kadri-police-station", name: "Kadri Police Station", station_name: "Kadri Police Station" },
  { id: "kankanady-town-police-station", name: "Kankanady Town Police Station", station_name: "Kankanady Town Police Station" },
  { id: "kankanady-rural-police-station", name: "Kankanady Rural Police Station", station_name: "Kankanady Rural Police Station" },
  { id: "mangalore-women-police-station", name: "Mangaluru Women Police Station", station_name: "Mangaluru Women Police Station" },
  { id: "traffic-east-police-station", name: "Traffic East Police Station", station_name: "Traffic East Police Station" },
  { id: "traffic-west-police-station", name: "Traffic West Police Station", station_name: "Traffic West Police Station" },
  { id: "cyber-police-station-mangalore", name: "Cyber Crime Police Station - Mangaluru", station_name: "Cyber Crime Police Station - Mangaluru" },
  { id: "economic-offences-police-station", name: "Economic Offences & Narcotics Police Station", station_name: "Economic Offences & Narcotics Police Station" },
  { id: "bajpe-police-station", name: "Bajpe Police Station", station_name: "Bajpe Police Station" },
  { id: "kaup-police-station", name: "Kaup Police Station", station_name: "Kaup Police Station" },
  { id: "mulki-police-station", name: "Mulki Police Station", station_name: "Mulki Police Station" },
  { id: "surathkal-police-station", name: "Surathkal Police Station", station_name: "Surathkal Police Station" },
  { id: "moodbidri-police-station", name: "Moodbidri Police Station", station_name: "Moodbidri Police Station" },
  { id: "vamanjoor-police-station", name: "Vamanjoor Police Station", station_name: "Vamanjoor Police Station" },
  { id: "kinnigoli-police-station", name: "Kinnigoli Police Station", station_name: "Kinnigoli Police Station" },
  { id: "bantwal-town-police-station", name: "Bantwal Town Police Station", station_name: "Bantwal Town Police Station" },
  { id: "bantwal-rural-police-station", name: "Bantwal Rural Police Station", station_name: "Bantwal Rural Police Station" },
  { id: "panemangalore-police-station", name: "Panemangalore Police Station", station_name: "Panemangalore Police Station" },
  { id: "vitla-police-station", name: "Vitla Police Station", station_name: "Vitla Police Station" },
  { id: "kowdoor-police-station", name: "Kowdoor Police Station", station_name: "Kowdoor Police Station" },
  { id: "narimogaru-police-station", name: "Narimogaru Police Station", station_name: "Narimogaru Police Station" },
  { id: "belthangady-police-station", name: "Belthangady Police Station", station_name: "Belthangady Police Station" },
  { id: "dharmasthala-police-station", name: "Dharmasthala Police Station", station_name: "Dharmasthala Police Station" },
  { id: "venur-police-station", name: "Venur Police Station", station_name: "Venur Police Station" },
  { id: "ujire-police-station", name: "Ujire Police Station", station_name: "Ujire Police Station" },
  { id: "puttur-town-police-station", name: "Puttur Town Police Station", station_name: "Puttur Town Police Station" },
  { id: "puttur-rural-police-station", name: "Puttur Rural Police Station", station_name: "Puttur Rural Police Station" },
  { id: "sullia-police-station", name: "Sullia Police Station", station_name: "Sullia Police Station" },
  { id: "kadaba-police-station", name: "Kadaba Police Station", station_name: "Kadaba Police Station" },
  { id: "subramanya-police-station", name: "Subramanya Police Station", station_name: "Subramanya Police Station" },
  { id: "bellare-police-station", name: "Bellare Police Station", station_name: "Bellare Police Station" },
  { id: "jalsoor-police-station", name: "Jalsoor Police Station", station_name: "Jalsoor Police Station" },
  { id: "aranthodu-police-station", name: "Aranthodu Police Station", station_name: "Aranthodu Police Station" }
];
