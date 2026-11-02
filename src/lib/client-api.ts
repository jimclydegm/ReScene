export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init, signal: init?.signal ?? AbortSignal.timeout(60_000),
      headers: { "Content-Type": "application/json", ...init?.headers }
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError")
      throw new Error("The connection timed out. Reload to check the saved result before trying again.");
    throw error;
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error?.message ?? "The request failed. Please try again.");
  if (result === null && response.status !== 204)
    throw new Error("The response could not be read. Reload to check the saved result before trying again.");
  return result as T;
}
