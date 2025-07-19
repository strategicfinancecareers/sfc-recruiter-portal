
import { useEffect, useState } from "react";
import { supabase } from "./client";

export const useSupabaseSession = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  return { session, loading };
};
