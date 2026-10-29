export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init, headers: { "Content-Type": "application/json", ...init?.headers }
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error?.message ?? "The request failed. Please try again.");
  return result as T;
}
