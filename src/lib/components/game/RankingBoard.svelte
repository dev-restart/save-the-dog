<script lang="ts">
	import { ArrowLeft, RefreshCw, Trophy, Upload } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
import type { PlayerLeaderboardEntry } from '$lib/game/online/types.js';
import type { SkinId } from '$lib/game/types.js';
import { CHALLENGE_STAGE_MAX, CHALLENGE_STAGE_MIN } from '$lib/game/stages/challenge.js';

interface VerifiedChallengeEntry {
	nickname: string;
	stars: number;
	clearTimeMs: number;
	inkRatio: number;
	verifiedAt: string;
}

	interface Props {
		nickname?: string;
		highestStage: number;
		totalClears: number;
		totalStars: number;
		skin: SkinId;
		onBack: () => void;
		onSubmit: () => Promise<void>;
	}

	let { nickname, highestStage, totalClears, totalStars, skin, onBack, onSubmit }: Props = $props();
	let entries = $state<PlayerLeaderboardEntry[]>([]);
	let verifiedEntries = $state<VerifiedChallengeEntry[]>([]);
	let isLoading = $state(true);
	let isSubmitting = $state(false);
	let message = $state('');
	let error = $state('');

	$effect(() => {
		void loadLeaderboard();
	});

	async function loadLeaderboard(force = false): Promise<void> {
		isLoading = true;
		error = '';
		try {
			const response = await fetch('/api/leaderboard', force ? { cache: 'no-store' } : undefined);
			const body = (await response.json()) as { entries?: PlayerLeaderboardEntry[]; message?: string };
			if (!response.ok) throw new Error(body.message ?? '랭킹을 불러오지 못했습니다.');
			entries = body.entries ?? [];
			if (highestStage >= CHALLENGE_STAGE_MIN) {
				const stageId = Math.min(CHALLENGE_STAGE_MAX, highestStage);
				const verifiedResponse = await fetch(`/api/challenges/replay?stageId=${stageId}`, force ? { cache: 'no-store' } : undefined);
				const verifiedBody = (await verifiedResponse.json()) as { entries?: VerifiedChallengeEntry[] };
				verifiedEntries = verifiedResponse.ok ? verifiedBody.entries ?? [] : [];
			} else {
				verifiedEntries = [];
			}
		} catch (cause) {
			error = cause instanceof Error ? cause.message : '랭킹을 불러오지 못했습니다.';
		} finally {
			isLoading = false;
		}
	}

	async function submit(): Promise<void> {
		if (isSubmitting) return;
		isSubmitting = true;
		message = '';
		error = '';
		try {
			await onSubmit();
			message = '현재 캐주얼 기록을 랭킹에 등록했습니다.';
			await loadLeaderboard(true);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : '기록을 등록하지 못했습니다.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<section class="ranking-screen" data-skin={skin}>
	<header class="ranking-header">
		<Button variant="secondary" size="icon-sm" aria-label="메뉴로 돌아가기" onclick={onBack}><ArrowLeft class="size-4" /></Button>
		<div><div class="eyebrow"><Trophy class="size-3.5" /> COMMUNITY RANKING</div><h1>플레이어 랭킹</h1></div>
		<Button variant="secondary" size="icon-sm" aria-label="랭킹 새로고침" onclick={() => void loadLeaderboard()}><RefreshCw class="size-4" /></Button>
	</header>

	<section class="my-record" aria-label="내 로컬 기록">
		<div><span class="record-label">내 기록</span><strong>{nickname ?? '오프라인 플레이어'}</strong></div>
		<div class="record-stats"><span>최고 {highestStage}단계</span><span>별 {totalStars.toFixed(1)}</span><span>클리어 {totalClears}</span></div>
		<Button size="sm" class="font-black" disabled={!nickname || isSubmitting} onclick={() => void submit()}><Upload class="size-3.5" /> 랭킹 등록</Button>
	</section>
	<p class="trust-note">캐주얼 기록은 브라우저 진행도를 등록합니다. 101단계부터는 드로잉 replay를 서버 물리로 재생한 검증 랭킹을 별도로 제공합니다.</p>
	{#if message}<p class="message" aria-live="polite">{message}</p>{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}

	<div class="ranking-list" aria-label="전체 플레이어 랭킹">
		{#if isLoading}<div class="empty">랭킹을 불러오는 중...</div>
		{:else if entries.length === 0}<div class="empty">아직 등록된 기록이 없습니다.</div>
		{:else}
			{#each entries as entry, index (entry.nickname)}
				<article class="ranking-row" class:my-row={entry.nickname === nickname}>
					<div class="rank-number">{index + 1}</div>
					<div class="rank-main"><strong>{entry.nickname}</strong><span>별 {entry.totalStars.toFixed(1)} · 클리어 {entry.totalClears}</span></div>
					<div class="rank-stage">{entry.highestStage}<small>단계</small></div>
				</article>
			{/each}
		{/if}
	</div>
	{#if highestStage >= CHALLENGE_STAGE_MIN}
		{@const verifiedStage = Math.min(CHALLENGE_STAGE_MAX, highestStage)}
		<section class="verified-section" aria-label={`시드 도전 ${verifiedStage}단계 검증 랭킹`}>
			<header><div><span>SERVER VERIFIED</span><strong>시드 도전 {verifiedStage}단계</strong></div><small>replay 검증 완료 기록</small></header>
			{#if verifiedEntries.length === 0}<div class="empty">아직 서버 검증 기록이 없습니다.</div>
			{:else}
				<div class="verified-list">
					{#each verifiedEntries as entry, index (entry.nickname)}
						<article class="verified-row" class:my-row={entry.nickname === nickname}><b>{index + 1}</b><strong>{entry.nickname}</strong><span>★ {entry.stars.toFixed(1)} · {(entry.clearTimeMs / 1000).toFixed(1)}초</span></article>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</section>

<style>
	.ranking-screen { min-height: 100%; overflow-y: auto; padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom)); background: linear-gradient(180deg, #e2f4ff, #fbfdff 48%, #e4f3d8); color: #17324b; }
	.ranking-screen[data-skin='minecraft'] { background: linear-gradient(180deg, #e5f2c6, #fbffe9 52%, #d8e9bd); }
	.ranking-screen[data-skin='lego'] { background: linear-gradient(180deg, #e8f4ff, #fff8dc 52%, #e3f2ff); }
	.ranking-header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .65rem; }
	.eyebrow { display: flex; align-items: center; gap: .3rem; color: #5c7890; font-size: .66rem; font-weight: 950; letter-spacing: .05em; }
	h1 { margin: .15rem 0 0; font-size: 1.35rem; font-weight: 950; }
	.my-record { display: grid; gap: .65rem; margin-top: 1rem; border: 1px solid rgba(73, 125, 153, .25); border-radius: 16px; background: rgba(255,255,255,.76); padding: .85rem; }
	.my-record > div:first-child { display: flex; justify-content: space-between; gap: .5rem; align-items: baseline; }
	.record-label { color: #638098; font-size: .68rem; font-weight: 900; }
	.my-record strong { font-size: .9rem; }
	.record-stats { display: flex; flex-wrap: wrap; gap: .35rem .7rem; color: #4f6e86; font-size: .72rem; font-weight: 800; }
	.trust-note { margin: .7rem 0; color: #6b8292; font-size: .68rem; font-weight: 700; line-height: 1.45; }
	.message, .error { margin: .5rem 0; font-size: .74rem; font-weight: 800; }
	.message { color: #197344; } .error { color: #b2382e; }
	.ranking-list { display: grid; gap: .45rem; }
	.ranking-row { display: grid; grid-template-columns: 2rem 1fr auto; align-items: center; gap: .55rem; border-bottom: 1px solid rgba(50, 83, 103, .14); padding: .7rem .35rem; }
	.my-row { border-radius: 12px; background: rgba(255, 229, 136, .35); padding-left: .55rem; padding-right: .55rem; }
	.rank-number { display: grid; width: 1.7rem; height: 1.7rem; place-items: center; border-radius: 50%; background: #eef5f8; color: #54768e; font-size: .76rem; font-weight: 950; }
	.rank-main { min-width: 0; display: grid; gap: .15rem; } .rank-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .84rem; } .rank-main span { color: #688299; font-size: .67rem; font-weight: 700; }
	.rank-stage { color: #cc8125; font-size: 1.05rem; font-weight: 950; text-align: right; } .rank-stage small { margin-left: .12rem; color: #688299; font-size: .62rem; }
	.empty { padding: 2.5rem 1rem; color: #688299; text-align: center; font-size: .8rem; font-weight: 800; }
	.verified-section { margin-top: 1rem; border: 1px solid rgba(55, 126, 89, .28); border-radius: 16px; background: rgba(240, 255, 243, .8); padding: .8rem; }
	.verified-section header { display: flex; align-items: end; justify-content: space-between; gap: .5rem; margin-bottom: .55rem; }
	.verified-section header div { display: grid; gap: .12rem; } .verified-section header span { color: #398158; font-size: .58rem; font-weight: 950; letter-spacing: .08em; } .verified-section header strong { color: #174d32; font-size: .88rem; font-weight: 950; } .verified-section header small { color: #5a826c; font-size: .62rem; font-weight: 800; }
	.verified-list { display: grid; gap: .25rem; } .verified-row { display: grid; grid-template-columns: 1.5rem 1fr auto; align-items: center; gap: .45rem; border-bottom: 1px solid rgba(55, 126, 89, .12); padding: .48rem .2rem; color: #29553b; font-size: .7rem; } .verified-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .verified-row span { white-space: nowrap; color: #5f806d; font-size: .63rem; font-weight: 800; }
</style>
