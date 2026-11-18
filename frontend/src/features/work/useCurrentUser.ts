import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { isDemo } from "@/services/demo";
export function useCurrentUser() {
  const demo = isDemo();
  const profile = useQuery({ queryKey: ["profile"], enabled: !demo, retry: 1, queryFn: async () => (await api.get<{userId:string;emailConfirmed:boolean}>("/api/auth/me")).data });
  return { id: demo ? "demo" : profile.data?.userId, loading: !demo && profile.isLoading, error: !demo && profile.isError };
}
