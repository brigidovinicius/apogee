"use client";

import { useCallback, useEffect, useState } from "react";
import type { CommunityPhoto, CommunityPhotoPage } from "@/lib/gallery-types";

export function useCommunityPhotos(initialPage?: CommunityPhotoPage, initialOffset = 0) {
  const [photos, setPhotos] = useState<CommunityPhoto[]>(initialPage?.photos ?? []);
  const [loading, setLoading] = useState(!initialPage);
  const [error, setError] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(initialPage?.nextOffset ?? null);
  const [loadingMore, setLoadingMore] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/gallery?offset=${initialOffset}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const body: { photos?: CommunityPhoto[]; nextOffset?: number | null } = await response.json();
      if (!Array.isArray(body.photos)) throw new Error();
      setPhotos(body.photos);
      setNextOffset(body.nextOffset ?? null);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [initialOffset]);

  useEffect(() => {
    if (initialPage) return;
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [initialPage, refresh]);

  const loadMore = useCallback(async () => {
    if (nextOffset === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/gallery?offset=${nextOffset}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const body: { photos?: CommunityPhoto[]; nextOffset?: number | null } = await response.json();
      if (!Array.isArray(body.photos)) throw new Error();
      setPhotos((current) => [...current, ...body.photos!.filter((photo) => !current.some((existing) => existing.id === photo.id))]);
      setNextOffset(body.nextOffset ?? null);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [nextOffset, loadingMore]);

  return { photos, loading, error, refresh, hasMore: nextOffset !== null, loadingMore, loadMore };
}
