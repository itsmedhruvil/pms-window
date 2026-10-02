'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, FileText, Image as ImageIcon, Loader2, Search } from 'lucide-react';
import { apiFetch, cn } from '@/lib/utils';

type MediaKind = 'all' | 'images' | 'files';

interface MediaItem {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  taskId: string;
  taskTitle: string;
  department: string;
  projectId: string | null;
  projectTitle: string;
  clientName: string;
}

interface MediaResponse {
  items: MediaItem[];
  page: number;
  hasMore: boolean;
}

interface MediaApiResponse {
  success: boolean;
  data?: MediaResponse;
  error?: string;
}

function isImage(item: MediaItem) {
  return item.type.startsWith('image/') || /\.(avif|gif|heic|jpeg|jpg|png|svg|webp)$/i.test(item.name);
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export function MediaClient() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<MediaKind>('all');
  const loadingRef = useRef(false);

  const loadPage = useCallback(async (nextPage: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    const result = await apiFetch<MediaResponse>(`/api/media?page=${nextPage}&limit=30`) as MediaApiResponse;
    loadingRef.current = false;
    setLoading(false);

    if (!result.success || !result.data) {
      setError(result.error || 'Could not load media.');
      return;
    }

    setItems((current) => nextPage === 1 ? result.data!.items : [...current, ...result.data!.items]);
    setPage(nextPage);
    setHasMore(result.data.hasMore);
  }, []);

  useEffect(() => {
    void loadPage(1);
  }, [loadPage]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (kind === 'images' && !isImage(item)) return false;
      if (kind === 'files' && isImage(item)) return false;
      if (!query) return true;
      return [item.name, item.projectTitle, item.clientName, item.taskTitle, item.department]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [items, kind, search]);

  const projectGroups = useMemo(() => {
    const groups = new Map<string, { title: string; clientName: string; items: MediaItem[] }>();
    for (const item of filteredItems) {
      const key = item.projectId || 'internal';
      const group = groups.get(key) || { title: item.projectTitle, clientName: item.clientName, items: [] };
      group.items.push(item);
      groups.set(key, group);
    }
    return Array.from(groups.entries())
      .map(([id, group]) => ({ id, ...group }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [filteredItems]);

  return (
    <main className="min-h-full bg-primary-50">
      <header className="border-b border-primary-200 bg-white px-5 py-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary-500">Project Library</p>
            <h1 className="mt-1 text-xl font-black text-dark-500">Media</h1>
            <p className="mt-1 text-xs font-mono text-primary-500">Task photos and files grouped by project</p>
          </div>
          <span className="text-xs font-mono text-primary-500">{filteredItems.length} loaded</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 border border-primary-200 bg-white px-3 py-2 sm:max-w-sm">
            <Search className="h-4 w-4 flex-shrink-0 text-primary-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search media, projects, tasks..."
              className="w-full bg-transparent text-xs font-mono text-dark-500 outline-none placeholder:text-primary-400"
            />
          </label>
          <div className="inline-flex border border-primary-200 bg-primary-50 p-0.5" role="group" aria-label="Filter media type">
            {(['all', 'images', 'files'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={cn(
                  'px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide',
                  kind === option ? 'bg-dark-500 text-white' : 'text-primary-500 hover:text-dark-500'
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="space-y-7 p-5 sm:p-8">
        {error && (
          <div className="border border-red-200 bg-white p-4 text-sm font-mono text-red-600">
            <p>{error}</p>
            <button type="button" onClick={() => void loadPage(page || 1)} className="mt-2 font-bold underline">Retry</button>
          </div>
        )}

        {projectGroups.map((group) => (
          <section key={group.id} aria-labelledby={`project-${group.id}`}>
            <div className="mb-3 flex items-end justify-between gap-3 border-b border-primary-200 pb-2">
              <div className="min-w-0">
                <h2 id={`project-${group.id}`} className="truncate text-sm font-black text-dark-500">{group.title}</h2>
                {group.clientName && <p className="mt-0.5 truncate text-[10px] font-mono text-primary-500">{group.clientName}</p>}
              </div>
              <span className="flex-shrink-0 text-[10px] font-mono text-primary-500">{group.items.length} items</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {group.items.map((item) => {
                const image = isImage(item);
                return (
                  <a
                    key={`${item.taskId}-${item.id}`}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group min-w-0 overflow-hidden border border-primary-200 bg-white hover:border-primary-400"
                    title={`Open ${item.name}`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-primary-100">
                      {image ? (
                        <Image src={item.url} alt={item.name} fill unoptimized sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 16vw" className="object-cover transition-transform group-hover:scale-[1.03]" />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-primary-400">
                          <FileText className="h-8 w-8" />
                          <span className="text-[9px] font-mono uppercase">{item.type.split('/').pop() || 'File'}</span>
                        </div>
                      )}
                      <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center bg-white/90 text-dark-500">
                        {image ? <ImageIcon className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-[11px] font-bold text-dark-500" title={item.name}>{item.name}</p>
                      <p className="mt-1 truncate text-[9px] font-mono text-primary-500" title={item.taskTitle}>{item.taskTitle}</p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[9px] font-mono text-primary-400">
                        <span className="truncate">{item.department}</span>
                        <span className="flex-shrink-0">{formatFileSize(item.size)}</span>
                      </div>
                      <p className="mt-1 text-[9px] font-mono text-primary-400">{formatUploadDate(item.uploadedAt)}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        ))}

        {!loading && !error && projectGroups.length === 0 && (
          <div className="border border-dashed border-primary-300 bg-white px-5 py-16 text-center">
            <ImageIcon className="mx-auto h-8 w-8 text-primary-300" />
            <p className="mt-3 text-sm font-mono text-primary-500">
              {items.length === 0 ? 'No task media uploaded yet' : 'No media matches this filter'}
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-5 text-xs font-mono text-primary-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading media
          </div>
        )}
        {!loading && hasMore && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void loadPage(page + 1)}
              className="border border-primary-300 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wide text-dark-500 hover:border-dark-500"
            >
              Load more media
            </button>
          </div>
        )}
      </div>
    </main>
  );
}