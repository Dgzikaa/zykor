'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

interface PageTitleContextType {
  pageTitle: string | null;
  pageDescription: string | null;
  setPageTitleForPath: (path: string, title: string | null) => void;
  setPageDescriptionForPath: (path: string, description: string | null) => void;
  setPageInfoForPath: (
    path: string,
    title: string | null,
    description?: string | null
  ) => void;
}

const PageTitleContext = createContext<PageTitleContextType | undefined>(
  undefined
);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [titlesByPath, setTitlesByPath] = useState<Record<string, string | null>>(
    {}
  );
  const [descriptionsByPath, setDescriptionsByPath] = useState<
    Record<string, string | null>
  >({});

  const setPageTitleForPath = useCallback((path: string, title: string | null) => {
    setTitlesByPath((prev) => {
      if (prev[path] === title) {
        return prev;
      }
      return { ...prev, [path]: title };
    });
  }, []);

  const setPageDescriptionForPath = useCallback(
    (path: string, description: string | null) => {
      setDescriptionsByPath((prev) => {
        if (prev[path] === description) {
          return prev;
        }
        return { ...prev, [path]: description };
      });
    },
    []
  );

  const setPageInfoForPath = useCallback((
    path: string,
    title: string | null,
    description?: string | null
  ) => {
    setPageTitleForPath(path, title);
    setPageDescriptionForPath(path, description || null);
  }, [setPageDescriptionForPath, setPageTitleForPath]);

  const pageTitle = pathname ? (titlesByPath[pathname] ?? null) : null;
  const pageDescription = pathname ? (descriptionsByPath[pathname] ?? null) : null;

  const contextValue = useMemo(
    () => ({
      pageTitle,
      pageDescription,
      setPageTitleForPath,
      setPageDescriptionForPath,
      setPageInfoForPath,
    }),
    [
      pageDescription,
      pageTitle,
      setPageDescriptionForPath,
      setPageInfoForPath,
      setPageTitleForPath,
    ]
  );

  return (
    <PageTitleContext.Provider value={contextValue}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle() {
  const pathname = usePathname();
  const context = useContext(PageTitleContext);
  if (context === undefined) {
    // Durante SSG/pre-rendering, retornar funções vazias em vez de lançar erro
    return {
      pageTitle: null,
      pageDescription: null,
      setPageTitle: () => {},
      setPageDescription: () => {},
      setPageInfo: () => {},
    };
  }

  const currentPath = pathname || '/';

  const setPageTitle = useCallback(
    (title: string | null) => context.setPageTitleForPath(currentPath, title),
    [context, currentPath]
  );
  const setPageDescription = useCallback(
    (description: string | null) =>
      context.setPageDescriptionForPath(currentPath, description),
    [context, currentPath]
  );
  const setPageInfo = useCallback(
    (title: string | null, description?: string | null) =>
      context.setPageInfoForPath(currentPath, title, description),
    [context, currentPath]
  );

  return useMemo(
    () => ({
      pageTitle: context.pageTitle,
      pageDescription: context.pageDescription,
      setPageTitle,
      setPageDescription,
      setPageInfo,
    }),
    [
      context.pageDescription,
      context.pageTitle,
      setPageDescription,
      setPageInfo,
      setPageTitle,
    ]
  );
}
