import { useEffect, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import {
  isUsefulImageUrl,
  readCachedImage,
  writeCachedImage,
} from "@shared/storage/sqlite-cache";

type CacheImageResult = {
  local_path: string;
};

type CachedImageProps = {
  src: string;
  alt?: string;
  className?: string;
  loading?: "eager" | "lazy";
};

const inFlightImageCache = new Map<string, Promise<string>>();

function cacheImageOnce(remoteUrl: string) {
  const existing = inFlightImageCache.get(remoteUrl);
  if (existing) return existing;

  const request = invoke<CacheImageResult>("cache_image", { remoteUrl })
    .then(async (result) => {
      await writeCachedImage({
        remoteUrl,
        localPath: result.local_path,
        updatedAt: Date.now(),
      });
      return result.local_path;
    })
    .finally(() => {
      inFlightImageCache.delete(remoteUrl);
    });

  inFlightImageCache.set(remoteUrl, request);
  return request;
}

export default function CachedImage({
  src,
  alt = "",
  className,
  loading = "lazy",
}: CachedImageProps) {
  const [cachedSrc, setCachedSrc] = useState<{ remoteUrl: string; displayUrl: string } | null>(null);
  const displaySrc = cachedSrc?.remoteUrl === src ? cachedSrc.displayUrl : src;

  useEffect(() => {
    if (!src) return;

    let cancelled = false;

    async function loadCachedImage() {
      if (!isUsefulImageUrl(src)) {
        setCachedSrc(null);
        return;
      }

      const cached = await readCachedImage(src);
      if (cancelled) return;

      if (cached?.localPath) {
        setCachedSrc({ remoteUrl: src, displayUrl: convertFileSrc(cached.localPath) });
        return;
      }

      try {
        const localPath = await cacheImageOnce(src);
        if (cancelled) return;
        setCachedSrc({ remoteUrl: src, displayUrl: convertFileSrc(localPath) });
      } catch {
        if (!cancelled) setCachedSrc(null);
      }
    }

    void loadCachedImage();

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <img
      src={displaySrc}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => {
        if (displaySrc !== src) setCachedSrc(null);
      }}
    />
  );
}
