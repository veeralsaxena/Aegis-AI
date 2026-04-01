"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";

interface User {
  uuid: string;
  display: string;
  username: string;
}

interface Provider {
  uuid: string;
  display: string;
}

interface AuthState {
  sessionId: string;
  user: User | null;
  provider: Provider | null;
  locationUuid: string;
  locationName: string;
  credentials: string; // base64 encoded
  authenticated: boolean;
}

interface AuthContextType extends AuthState {
  loading: boolean; // true while checking session on mount
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setSessionLocation: (uuid: string, name: string) => Promise<boolean>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<AuthState>({
    sessionId: "",
    user: null,
    provider: null,
    locationUuid: "",
    locationName: "",
    credentials: "",
    authenticated: false,
  });

  // Restore session from cookies on mount
  useEffect(() => {
    const creds = Cookies.get("omni_credentials");
    const sessionId = Cookies.get("bahmni_session");
    const locUuid = Cookies.get("omni_location_uuid") || "";
    const locName = Cookies.get("omni_location_name") || "";

    if (creds) {
      // Verify session is still valid
      fetch("/openmrs/ws/rest/v1/session", {
        headers: { 
          Authorization: "Basic " + creds,
          "ngrok-skip-browser-warning": "true"
        },
        credentials: "omit",
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.authenticated) {
            setState({
              sessionId: data.sessionId || sessionId,
              user: data.user
                ? { uuid: data.user.uuid, display: data.user.display, username: data.user.username || data.user.display }
                : null,
              provider: data.currentProvider
                ? { uuid: data.currentProvider.uuid, display: data.currentProvider.display }
                : null,
              locationUuid: locUuid,
              locationName: locName,
              credentials: creds,
              authenticated: true,
            });
          } else {
            // Session expired — clear cookies
            Cookies.remove("omni_credentials");
            Cookies.remove("bahmni_session");
            Cookies.remove("omni_location_uuid");
            Cookies.remove("omni_location_name");
          }
        })
        .catch(() => {
          // Network error — keep cookies, mark as not authenticated
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // No cookies — not authenticated
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    if (!username || !password) {
      return { success: false, error: "Username and password are required" };
    }
    
    const creds = btoa(username + ":" + password);

    try {

      // Authenticate with Basic auth
      const response = await fetch("/openmrs/ws/rest/v1/session", {
        headers: {
          Authorization: "Basic " + creds,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        credentials: "omit",
        cache: "no-store",
      });

      if (!response.ok) {
        return { success: false, error: "Server returned " + response.status };
      }

      const data = await response.json();

      if (!data.authenticated) {
        return { success: false, error: "Invalid username or password" };
      }

      // Extract JSESSIONID from response
      const sessionId = data.sessionId || "";

      // Store credentials and session in cookies
      Cookies.set("omni_credentials", creds, { expires: 1, path: "/" });
      Cookies.set("bahmni_session", sessionId, { expires: 1, path: "/" });

      setState({
        sessionId,
        user: data.user
          ? { uuid: data.user.uuid, display: data.user.display, username: data.user.username || username }
          : null,
        provider: data.currentProvider
          ? { uuid: data.currentProvider.uuid, display: data.currentProvider.display }
          : null,
        locationUuid: "",
        locationName: "",
        credentials: creds,
        authenticated: true,
      });

      return { success: true };
    } catch {
      return { success: false, error: "Unable to connect to Bahmni backend" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/openmrs/ws/rest/v1/session", {
        method: "DELETE",
        headers: {
          ...(state.credentials ? { Authorization: "Basic " + state.credentials } : {}),
          "ngrok-skip-browser-warning": "true"
        },
        credentials: "omit",
        cache: "no-store",
      }).catch(() => {});
    } catch {
      // ignore
    }
    Cookies.remove("omni_credentials");
    Cookies.remove("bahmni_session");
    Cookies.remove("omni_location_uuid");
    Cookies.remove("omni_location_name");
    setState({
      sessionId: "",
      user: null,
      provider: null,
      locationUuid: "",
      locationName: "",
      credentials: "",
      authenticated: false,
    });
    router.push("/login");
  }, [router]);

  const setSessionLocation = useCallback(
    async (uuid: string, name: string) => {
      try {
        Cookies.set("omni_location_uuid", uuid, { expires: 1, path: "/" });
        Cookies.set("omni_location_name", name, { expires: 1, path: "/" });
        setState((prev) => ({ ...prev, locationUuid: uuid, locationName: name }));
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers);
      if (state.credentials) {
        headers.set("Authorization", "Basic " + state.credentials);
      }
      headers.set("ngrok-skip-browser-warning", "true");
      
      if (!headers.has("Content-Type") && options.method && options.method !== "GET") {
        headers.set("Content-Type", "application/json");
      }
      return fetch(url, { ...options, headers, credentials: "omit", cache: "no-store" });
    },
    [state.credentials]
  );

  return (
    <AuthContext.Provider
      value={{
        ...state,
        loading,
        login,
        logout,
        setSessionLocation,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
