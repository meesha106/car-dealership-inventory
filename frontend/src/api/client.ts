export interface PublicUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
}

export interface SessionResponse {
  token: string;
  user: PublicUser;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
}

export interface PurchaseResponse {
  purchase: {
    id: string;
    userId: string;
    vehicleId: string;
    vehicleMake: string;
    vehicleModel: string;
    priceSnapshot: number;
  };
  vehicle: Vehicle;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

const sessionStorageKey = "car-dealership-session";
const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    status: number,
    code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    authenticated?: boolean;
  } = {},
): Promise<T> {
  const { method = "GET", body, authenticated = true } = options;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const session = getStoredSession();
  if (authenticated && session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && authenticated) {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }

  const payload = (await response.json()) as T | ApiErrorBody;
  if (!response.ok) {
    const errorBody = payload as ApiErrorBody;
    throw new ApiError(
      response.status,
      errorBody.error?.code ?? "REQUEST_FAILED",
      errorBody.error?.message ?? "The request could not be completed.",
    );
  }
  return payload as T;
}

export function getStoredSession(): SessionResponse | null {
  const rawSession = localStorage.getItem(sessionStorageKey);
  if (!rawSession) {
    return null;
  }

  try {
    const session = JSON.parse(rawSession) as SessionResponse;
    if (
      typeof session.token === "string" &&
      typeof session.user?.id === "string" &&
      typeof session.user?.email === "string" &&
      (session.user.role === "USER" || session.user.role === "ADMIN")
    ) {
      return session;
    }
  } catch {
    // Invalid local session data is discarded below.
  }

  localStorage.removeItem(sessionStorageKey);
  return null;
}

export async function register(
  credentials: { email: string; password: string },
): Promise<SessionResponse> {
  return request("/api/auth/register", {
    method: "POST",
    body: credentials,
    authenticated: false,
  });
}

export async function login(
  credentials: { email: string; password: string },
): Promise<SessionResponse> {
  return request("/api/auth/login", {
    method: "POST",
    body: credentials,
    authenticated: false,
  });
}

export async function getVehicles(filters: URLSearchParams = new URLSearchParams()) {
  const query = filters.size > 0 ? `/search?${filters.toString()}` : "";
  const result = await request<{ vehicles: Vehicle[] }>(
    `/api/vehicles${query}`,
  );
  return result.vehicles;
}

export async function purchaseVehicle(vehicleId: string) {
  return request<PurchaseResponse>(`/api/vehicles/${vehicleId}/purchase`, {
    method: "POST",
    body: {},
  });
}

export async function createVehicle(
  vehicle: Omit<Vehicle, "id">,
): Promise<{ vehicle: Vehicle }> {
  return request("/api/vehicles", { method: "POST", body: vehicle });
}

export async function updateVehicle(
  vehicleId: string,
  vehicle: Pick<Vehicle, "make" | "model" | "category" | "price">,
): Promise<{ vehicle: Vehicle }> {
  return request(`/api/vehicles/${vehicleId}`, {
    method: "PUT",
    body: vehicle,
  });
}

export async function deleteVehicle(
  vehicleId: string,
): Promise<{ message: string }> {
  return request(`/api/vehicles/${vehicleId}`, { method: "DELETE" });
}

export async function restockVehicle(
  vehicleId: string,
  quantity: number,
): Promise<{ vehicle: Vehicle }> {
  return request(`/api/vehicles/${vehicleId}/restock`, {
    method: "POST",
    body: { quantity },
  });
}
