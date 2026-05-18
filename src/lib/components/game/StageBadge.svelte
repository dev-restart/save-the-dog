<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';

	interface Props {
		stage: number;
		difficulty?: string;
	}

	const DIFFICULTY_LABELS: Record<string, string> = {
		Ready: '준비',
		Tutorial: '연습',
		Easy: '쉬움',
		'Ink Cut': '잉크 제한',
		Hazard: '위험 지형',
		Cross: '교차 공격',
		'Two Hives': '벌집 2개',
		Wall: '벽 활용',
		Angle: '각도 공략',
		Checkpoint: '중간 난도',
		Tight: '좁은 공간',
		Split: '분산 공격',
		Pressure: '압박',
		Fast: '빠름',
		Cage: '감싸기 제한',
		Late: '후반',
		Expert: '전문가',
		'Stage 20': '최종 연습'
	};

	let { stage, difficulty = 'Ready' }: Props = $props();
	let displayDifficulty = $derived(DIFFICULTY_LABELS[difficulty] ?? difficulty.replace(/^Loop (\d+)$/, '반복 $1'));
</script>

<div class="flex items-center gap-1.5">
	<Badge variant="secondary" class="border border-slate-900/10 bg-white/85 px-2 py-1 text-slate-900 shadow-sm">
		{stage}단계
	</Badge>
	<span class="max-w-24 truncate text-[11px] font-semibold text-slate-600">{displayDifficulty}</span>
</div>
