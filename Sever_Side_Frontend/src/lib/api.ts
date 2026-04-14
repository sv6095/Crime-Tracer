// src/lib/api.ts

import axios from "axios";

// Change this to your backend URL
// or use an env variable if you have one
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3000"; // <-- put your backend URL here

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // set to false if you don't use cookies/sessions
  headers: {
    "Content-Type": "application/json",
  },
});

// (Optional) You can add interceptors here later if you want auth tokens, logging, etc.
// api.interceptors.request.use((config) => {
//   // e.g., attach JWT token
//   return config;
// });
