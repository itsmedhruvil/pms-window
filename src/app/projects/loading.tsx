import { TableSkeleton } from '@/components/ui/skeletons';

export default function ProjectsLoading() {
  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div>
          <div className="h-6 w-24 bg-gray-100 animate-pulse mb-1" />
          <div className="h-3 w-32 bg-gray-100 animate-pulse" />
        </div>
        <div className="h-8 w-28 bg-gray-100 animate-pulse" />
      </div>
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
