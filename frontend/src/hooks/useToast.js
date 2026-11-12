import { useCallback, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  return { toast, notify, clearToast };
}
