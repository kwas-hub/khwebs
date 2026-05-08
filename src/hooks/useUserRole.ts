// Backwards-compatible wrapper around AuthContext.
import { useAuth, AppRole as A } from "@/contexts/AuthContext";

export type AppRole = A;

export const useUserRole = () => {
  const { role, userId, loading, isAdmin, isEditor, isGuest, canBackend } = useAuth();
  return { role, userId, loading, isAdmin, isEditor, isGuest, canBackend };
};
