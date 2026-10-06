import ProjectModel from '@/models/Project';
import { ProjectStatus } from '@/types';

/**
 * Archive rule: a project with status `completed` is considered archived.
 * Its tasks must not appear in live task list views — they remain reachable
 * via Previous Work (/projects?tab=previous) and the project's own detail page.
 */

export async function getArchivedProjectIds(): Promise<string[]> {
  const docs = await ProjectModel.find({ status: ProjectStatus.COMPLETED })
    .select('_id')
    .lean();
  return docs.map((d) => d._id.toString());
}

/**
 * Mutates a Mongoose/Mongo task `query` object so tasks belonging to
 * archived (completed) projects are excluded. Internal tasks
 * (`projectId: null`) are always kept.
 *
 * Pass `skip=true` when the caller explicitly targets one project
 * (project detail view) — archived projects must still show their tasks.
 */
export function applyLiveProjectFilter(
  query: Record<string, unknown>,
  archivedIds: string[],
  opts: { skip?: boolean } = {},
): void {
  if (opts.skip) return;
  // Explicit single-project view (incl. archived project detail) — no filtering.
  if (query.projectId && typeof query.projectId === 'string') return;
  if (archivedIds.length === 0) return;
  const and = (query.$and as unknown[] | undefined) ?? [];
  and.push({
    $or: [{ projectId: null }, { projectId: { $nin: archivedIds } }],
  });
  query.$and = and;
}

/** Aggregation `$match` stage fragment excluding archived project tasks. */
export const LIVE_TASKS_LOOKUP_STAGES = [
  {
    $lookup: {
      from: 'projects',
      localField: 'projectId',
      foreignField: '_id',
      as: '_archProj',
    },
  },
  {
    $match: {
      $or: [
        { projectId: null },
        { projectId: { $exists: false } },
        { _archProj: { $size: 0 } },
        { '_archProj.status': { $ne: ProjectStatus.COMPLETED } },
      ],
    },
  },
] as unknown[];
