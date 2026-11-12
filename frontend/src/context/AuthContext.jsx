import React, { createContext, useContext, useState } from "react";
import { drishtiApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("drishti360_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem("drishti360_user");
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const persistSession = (res) => {
    localStorage.setItem("drishti360_token", res.access_token);
    localStorage.setItem("drishti360_user", JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await drishtiApi.login({ email, password });
      return persistSession(res);
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      const res = await drishtiApi.register(payload);
      return persistSession(res);
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async (role = "farmer") => {
    setLoading(true);
    try {
      const res = await drishtiApi.demoLogin(role);
      return persistSession(res);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("drishti360_token");
    localStorage.removeItem("drishti360_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, demoLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
