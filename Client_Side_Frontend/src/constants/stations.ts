// Minimal DK stations list – extend as you like
export type Station = {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
};

export const DK_POLICE_STATIONS: Station[] = [
  { id: "barke-police-station", name: "Barke Police Station" },
  { id: "pandeshwar-police-station", name: "Pandeshwar Police Station" },
  { id: "mangalore-east-police-station", name: "Mangaluru East Police Station" },
  { id: "mangalore-north-police-station", name: "Mangaluru North Police Station" },
  { id: "urwa-police-station", name: "Urwa Police Station" },
  { id: "kadri-police-station", name: "Kadri Police Station" },
  { id: "kankanady-town-police-station", name: "Kankanady Town Police Station" },
  { id: "kankanady-rural-police-station", name: "Kankanady Rural Police Station" },
  { id: "mangalore-women-police-station", name: "Mangaluru Women Police Station" },
  { id: "traffic-east-police-station", name: "Traffic East Police Station" },
  { id: "traffic-west-police-station", name: "Traffic West Police Station" },
  { id: "cyber-police-station-mangalore", name: "Cyber Crime Police Station - Mangaluru" },
  { id: "economic-offences-police-station", name: "Economic Offences & Narcotics Police Station" },
  { id: "bajpe-police-station", name: "Bajpe Police Station" },
  { id: "mulki-police-station", name: "Mulki Police Station" },
  { id: "surathkal-police-station", name: "Surathkal Police Station" },
  { id: "konaje-police-station", name: "Konaje Police Station" },
  { id: "moodbidri-police-station", name: "Moodbidri Police Station" },
  { id: "venur-police-station", name: "Venur Police Station" },
  { id: "belthangady-police-station", name: "Belthangady Police Station" },
  { id: "venoor-police-station", name: "Vennur Police Station" },
  { id: "puttur-town-police-station", name: "Puttur Town Police Station" },
  { id: "puttur-rural-police-station", name: "Puttur Rural Police Station" },
  { id: "sullia-police-station", name: "Sullia Police Station" },
  { id: "kadaba-police-station", name: "Kadaba Police Station" },
  { id: "subramanya-police-station", name: "Subramanya Police Station" },
  { id: "bellare-police-station", name: "Bellare Police Station" },
  { id: "jalsoor-police-station", name: "Jalsoor Police Station" },
  { id: "aranthodu-police-station", name: "Aranthodu Police Station" },
];
