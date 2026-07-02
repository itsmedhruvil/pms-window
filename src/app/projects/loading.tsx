import { TableSkeleton } from '@/components/ui/skeletons';

export default function ProjectsLoading() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-primary-200">
        <div>
          <div className="h-6 w-24 bg-primary-100 animate-pulse mb-1" />
          <div className="h-3 w-32 bg-primary-100 animate-pulse" />
        </div>
        <div className="h-8 w-28 bg-primary-100 animate-pulse" />
      </div>
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
