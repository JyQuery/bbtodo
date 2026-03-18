import { useEffect } from "react";

import { appTitle } from "../app/constants";

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${appTitle}` : appTitle;
  }, [title]);
}
