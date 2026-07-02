import { DashboardSkeleton } from '@/components/ui/skeletons';

export default function DashboardLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 pb-4 border-b border-primary-200">
        <div className="h-6 w-48 bg-primary-100 animate-pulse mb-1" />
        <div className="h-3 w-64 bg-primary-100 animate-pulse" />
      </div>
      <DashboardSkeleton />
    </div>
  );
}
