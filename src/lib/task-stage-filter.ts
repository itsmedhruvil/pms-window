import { STAGE_SEQUENCE, STAGE_TASK_CATEGORIES } from '@/types';

function titlePattern(title: string): RegExp {
  return new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function missingStageFilter() {
  return {
    $or: [
      { stage: { $exists: false } },
      { stage: null },
      { stage: '' },
    ],
  };
}

/** Matches explicit stages and the same title-based fallback used by resolveTaskStage. */
export function getTaskStageFilter(stage: string): Record<string, unknown> | null {
  if (stage === 'uncategorized') {
    return {
      $and: [
        missingStageFilter(),
        { $nor: STAGE_TASK_CATEGORIES.map((category) => ({ title: titlePattern(category.title) })) },
      ],
    };
  }

  if (!STAGE_SEQUENCE.includes(stage as (typeof STAGE_SEQUENCE)[number])) return null;

  const stageCategories = STAGE_TASK_CATEGORIES.filter((category) => category.stage === stage);
  if (stageCategories.length === 0) return { stage };

  const lastMatchingCategoryIndex = STAGE_TASK_CATEGORIES.reduce(
    (lastIndex, category, index) => category.stage === stage ? index : lastIndex,
    -1
  );
  const earlierOtherStageTitles = STAGE_TASK_CATEGORIES
    .slice(0, lastMatchingCategoryIndex)
    .filter((category) => category.stage !== stage)
    .map((category) => ({ title: titlePattern(category.title) }));

  return {
    $or: [
      { stage },
      {
        $and: [
          missingStageFilter(),
          { $or: stageCategories.map((category) => ({ title: titlePattern(category.title) })) },
          ...(earlierOtherStageTitles.length > 0 ? [{ $nor: earlierOtherStageTitles }] : []),
        ],
      },
    ],
  };
}