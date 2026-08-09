<script lang="ts">
	import { Dices, LockKeyhole, Sparkles } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	interface Props {
		onCreate: (nickname?: string) => Promise<void>;
	}

	let { onCreate }: Props = $props();
	const RANDOM_ADJECTIVES = ['용감한', '신비한', '행복한', '느긋한', '재빠른', '똑똑한', '씩씩한', '졸린', '달콤한', '행운의'];
	const RANDOM_NOUNS = ['강아지', '구름', '돌멩이', '탐험가', '토끼', '여우', '별빛', '나무늘보', '고양이', '무지개'];
	const generatedNames = new Set<string>();
	let nickname = $state(generateRandomNickname());
	let isSubmitting = $state(false);
	let error = $state('');

	function generateRandomNickname(): string {
		for (let attempt = 0; attempt < 20; attempt += 1) {
			const adjective = RANDOM_ADJECTIVES[Math.floor(Math.random() * RANDOM_ADJECTIVES.length)];
			const noun = RANDOM_NOUNS[Math.floor(Math.random() * RANDOM_NOUNS.length)];
			const candidate = `${adjective}${noun}`;
			if (!generatedNames.has(candidate)) {
				generatedNames.add(candidate);
				return candidate;
			}
		}
		return `행운의강아지${10 + Math.floor(Math.random() * 9990)}`;
	}

	function regenerateNickname(): void {
		if (isSubmitting) return;
		nickname = generateRandomNickname();
		error = '';
	}

	async function create(value = nickname.trim()): Promise<void> {
		if (isSubmitting) return;
		error = '';
		isSubmitting = true;
		try {
			await onCreate(value);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : '닉네임을 만들지 못했습니다.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<section class="onboarding" aria-labelledby="nickname-title">
	<div class="onboarding-card">
		<div class="onboarding-icon"><Sparkles class="size-7" /></div>
		<p class="eyebrow">SAVE THE DOG · COMMUNITY</p>
		<h1 id="nickname-title">플레이어 이름을 정해주세요.</h1>
		<p class="description">한 번 만들면 변경할 수 없어요.</p>
		<label for="nickname">닉네임 <span>마음에 들 때까지 다시 생성할 수 있어요</span></label>
		<input id="nickname" bind:value={nickname} maxlength="20" autocomplete="off" placeholder="예: 용감한강아지" disabled={isSubmitting} onkeydown={(event) => event.key === 'Enter' && void create()} />
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="actions">
			<Button variant="secondary" class="h-11 font-black" disabled={isSubmitting} onclick={regenerateNickname}>
				<Dices class="size-4" /> 다시 생성
			</Button>
			<Button class="h-11 font-black" disabled={isSubmitting || nickname.trim().length === 0} onclick={() => void create()}>
				닉네임으로 시작
			</Button>
		</div>
		<div class="privacy-note"><LockKeyhole class="size-3.5" /> 다른 사용자의 닉네임은 사용 할 수 없어요.</div>
	</div>
</section>

<style>
	.onboarding { display: grid; min-height: 100%; place-items: center; padding: 1.25rem; background: radial-gradient(circle at top, #e4f7ff, #d9edf7 42%, #cde5d1); color: #17324b; }
	.onboarding-card { width: min(100%, 390px); border: 1px solid rgba(65, 118, 151, .25); border-radius: 24px; background: rgba(255,255,255,.9); padding: 1.4rem; box-shadow: 0 22px 54px rgba(30, 72, 91, .16); }
	.onboarding-icon { display: grid; width: 3.2rem; height: 3.2rem; place-items: center; border-radius: 16px; background: #ffe18a; color: #986117; }
	.eyebrow { margin: 1rem 0 .3rem; color: #62809a; font-size: .68rem; font-weight: 950; letter-spacing: .08em; }
	h1 { margin: 0; font-size: 1.55rem; font-weight: 950; }
	.description { margin: .55rem 0 1rem; color: #557088; font-size: .78rem; font-weight: 700; line-height: 1.6; }
	label { display: flex; align-items: baseline; justify-content: space-between; gap: .5rem; margin-bottom: .35rem; font-size: .78rem; font-weight: 900; }
	label span { color: #6a8496; font-size: .64rem; font-weight: 700; }
	input { width: 100%; height: 2.8rem; border: 1px solid #b8cfe0; border-radius: 11px; background: #fff; padding: 0 .8rem; color: #17324b; font-size: .9rem; font-weight: 800; outline: none; }
	input:focus { border-color: #2e8acc; box-shadow: 0 0 0 3px rgba(46, 138, 204, .16); }
	.error { margin: .45rem 0 0; color: #b2382e; font-size: .75rem; font-weight: 800; }
	.actions { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; margin-top: 1rem; }
	.privacy-note { display: flex; align-items: flex-start; gap: .35rem; margin-top: .9rem; color: #6a8496; font-size: .68rem; font-weight: 700; line-height: 1.45; }
</style>
