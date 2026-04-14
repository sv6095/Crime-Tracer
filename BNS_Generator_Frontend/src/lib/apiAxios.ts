// src/lib/apiAxios.ts
import axios from "axios";

const api = axios.create({
  baseURL: "", // <-- LET VITE PROXY HANDLE IT
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

export async function predictAxios(data: any, opts: any = {}) {
  return api
    .post("/predict", data, opts)
    .then((res) => res.data)
    .catch((err) => {
      throw err;
    });
}
