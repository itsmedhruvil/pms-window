import { KanbanSkeleton } from '@/components/ui/skeletons';

export default function ProjectDetailLoading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header skeleton */}
      <div className="border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-24 bg-gray-100 animate-pulse" />
              <div className="h-3 w-3 bg-gray-100 animate-pulse" />
              <div className="h-3 w-16 bg-gray-100 animate-pulse" />
            </div>
            <div className="h-7 w-80 bg-gray-100 animate-pulse" />
            <div className="flex gap-2">
              <div className="h-6 w-24 bg-gray-100 animate-pulse" />
              <div className="h-6 w-16 bg-gray-100 animate-pulse" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-9 w-16 bg-gray-100 animate-pulse" />
            <div className="h-3 w-16 bg-gray-100 animate-pulse" />
          </div>
        </div>
        <div className="mt-4 h-1.5 w-full bg-gray-100 animate-pulse" />
        <div className="flex gap-6 mt-3">
          <div className="h-3 w-28 bg-gray-100 animate-pulse" />
          <div className="h-3 w-20 bg-gray-100 animate-pulse" />
        </div>
      </div>
      {/* Tabs skeleton */}
      <div className="border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {[80, 96, 72, 80].map((w, i) => (
            <div key={i} className={`px-4 py-3`}>
              <div className={`h-3 w-${w / 4} bg-gray-100 animate-pulse`} style={{ width: w }} />
            </div>
          ))}
        </div>
      </div>
      {/* Kanban skeleton */}
      <div className="p-6">
        <KanbanSkeleton />
      </div>
    </div>
  );
}
