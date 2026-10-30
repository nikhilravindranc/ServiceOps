import { useEffect } from "react";

/** Opens a page's "new record" drawer when the global Create (+) menu sends the user here with ?new=1. */
export function useOpenOnNew(open: () => void) {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") !== "1") return;
    open();
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
