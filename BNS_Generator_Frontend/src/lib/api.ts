// src/lib/api.ts

export async function predict(payload: any) {
  const res = await fetch("/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status}`);
  }

  return await res.json();
}
