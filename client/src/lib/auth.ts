export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  group?: string;
  provider: "email" | "google" | "microsoft";
  avatar: string;
}

export const getAuthUser = (): AuthUser | null => {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

export const setAuthUser = (user: AuthUser): void => {
  localStorage.setItem("user", JSON.stringify(user));
};

export const logout = (): void => {
  localStorage.removeItem("user");
};

export const isAuthenticated = (): boolean => {
  return !!getAuthUser();
};
