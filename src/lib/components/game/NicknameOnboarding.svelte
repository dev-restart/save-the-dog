<script lang="ts">
	import { Dices, LockKeyhole, LogIn, ShieldCheck, UserRoundPlus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	interface Props {
		onRegister: (nickname: string, password: string) => Promise<void>;
		onLogin: (nickname: string, password: string) => Promise<void>;
	}

	let { onRegister, onLogin }: Props = $props();
	const RANDOM_ADJECTIVES = ['용감한', '신비한', '행복한', '느긋한', '재빠른', '똑똑한', '씩씩한', '졸린', '달콤한', '행운의'];
	const RANDOM_NOUNS = ['강아지', '구름', '돌멩이', '탐험가', '토끼', '여우', '별빛', '나무늘보', '고양이', '무지개'];
	const generatedNames = new Set<string>();
	let mode = $state<'register' | 'login'>('register');
	let nickname = $state(generateRandomNickname());
	let password = $state('');
	let passwordConfirm = $state('');
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

	function switchMode(nextMode: 'register' | 'login'): void {
		if (isSubmitting || mode === nextMode) return;
		mode = nextMode;
		password = '';
		passwordConfirm = '';
		error = '';
		if (nextMode === 'register') nickname = generateRandomNickname();
		else nickname = '';
	}

	function regenerateNickname(): void {
		if (isSubmitting) return;
		nickname = generateRandomNickname();
		error = '';
	}

	async function submit(): Promise<void> {
		if (isSubmitting) return;
		const trimmedNickname = nickname.trim();
		if (trimmedNickname.length === 0) return;
		if (password.length < 8) {
			error = '비밀번호는 8자 이상 입력하세요.';
			return;
		}
		if (mode === 'register' && password !== passwordConfirm) {
			error = '비밀번호 확인이 일치하지 않습니다.';
			return;
		}
		error = '';
		isSubmitting = true;
		try {
			if (mode === 'register') await onRegister(trimmedNickname, password);
			else await onLogin(trimmedNickname, password);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : mode === 'register' ? '계정을 만들지 못했습니다.' : '로그인하지 못했습니다.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<section class="onboarding" aria-labelledby="nickname-title">
	<div class="onboarding-card">
		<div class="onboarding-icon"><ShieldCheck class="size-7" /></div>
		<p class="eyebrow">SAVE THE DOG · ACCOUNT</p>
		<h1 id="nickname-title">계정으로 게임을 시작하세요</h1>
		<p class="description">진행 기록과 제작 지도는 계정에 안전하게 저장됩니다. 로그인하면 어느 기기에서든 저장된 기록을 불러올 수 있습니다.</p>

		<div class="mode-tabs" role="tablist" aria-label="계정 방식">
			<button class:active={mode === 'register'} role="tab" aria-selected={mode === 'register'} onclick={() => switchMode('register')}><UserRoundPlus class="size-4" /> 회원가입</button>
			<button class:active={mode === 'login'} role="tab" aria-selected={mode === 'login'} onclick={() => switchMode('login')}><LogIn class="size-4" /> 로그인</button>
		</div>

		<label for="nickname">닉네임 <span>{mode === 'register' ? '생성 후에는 변경할 수 없어요' : '가입한 닉네임을 입력하세요'}</span></label>
		<div class="nickname-row">
			<input id="nickname" bind:value={nickname} maxlength="20" autocomplete="username" placeholder="예: 용감한강아지" disabled={isSubmitting} />
			{#if mode === 'register'}
				<Button variant="secondary" size="icon" aria-label="랜덤 닉네임 다시 생성" title="다시 생성" disabled={isSubmitting} onclick={regenerateNickname}><Dices class="size-4" /></Button>
			{/if}
		</div>

		<label for="password">비밀번호 <span>8~128자</span></label>
		<input id="password" type="password" bind:value={password} maxlength="128" autocomplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="비밀번호" disabled={isSubmitting} onkeydown={(event) => mode === 'login' && event.key === 'Enter' && void submit()} />
		{#if mode === 'register'}
			<label for="password-confirm">비밀번호 확인</label>
			<input id="password-confirm" type="password" bind:value={passwordConfirm} maxlength="128" autocomplete="new-password" placeholder="비밀번호를 한 번 더 입력" disabled={isSubmitting} onkeydown={(event) => event.key === 'Enter' && void submit()} />
		{/if}

		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<Button class="submit h-11 w-full font-black" disabled={isSubmitting || nickname.trim().length === 0 || password.length < 8} onclick={() => void submit()}>
			{mode === 'register' ? '회원가입 후 시작' : '로그인'}
		</Button>
		<div class="privacy-note"><LockKeyhole class="size-3.5" /> 비밀번호 원문은 저장하지 않으며 계정 정보는 로그인과 기록 저장에만 사용됩니다.</div>
	</div>
</section>

<style>
	.onboarding { display: grid; min-height: 100%; place-items: center; padding: 1.25rem; background: radial-gradient(circle at top, #e4f7ff, #d9edf7 42%, #cde5d1); color: #17324b; }
	.onboarding-card { width: min(100%, 410px); border: 1px solid rgba(65, 118, 151, .25); border-radius: 24px; background: rgba(255,255,255,.96); padding: 1.4rem; box-shadow: 0 22px 54px rgba(30, 72, 91, .2); }
	.onboarding-icon { display: grid; width: 3.2rem; height: 3.2rem; place-items: center; border-radius: 16px; background: #ffe18a; color: #986117; }
	.eyebrow { margin: 1rem 0 .3rem; color: #62809a; font-size: .68rem; font-weight: 950; letter-spacing: .08em; }
	h1 { margin: 0; font-size: 1.55rem; font-weight: 950; }
	.description { margin: .55rem 0 1rem; color: #557088; font-size: .75rem; font-weight: 700; line-height: 1.55; }
	.mode-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: .35rem; margin-bottom: 1rem; border-radius: 12px; background: #e9f1f6; padding: .25rem; }
	.mode-tabs button { display: flex; align-items: center; justify-content: center; gap: .35rem; min-height: 2.35rem; border: 0; border-radius: 9px; background: transparent; color: #668095; font-size: .74rem; font-weight: 900; cursor: pointer; }
	.mode-tabs button.active { background: #fff; color: #245b7f; box-shadow: 0 2px 8px rgba(34, 73, 99, .12); }
	label { display: flex; align-items: baseline; justify-content: space-between; gap: .5rem; margin: .7rem 0 .35rem; font-size: .78rem; font-weight: 900; }
	label span { color: #6a8496; font-size: .64rem; font-weight: 700; }
	.nickname-row { display: grid; grid-template-columns: 1fr auto; gap: .4rem; }
	input { width: 100%; height: 2.8rem; border: 1px solid #b8cfe0; border-radius: 11px; background: #fff; padding: 0 .8rem; color: #17324b; font-size: .9rem; font-weight: 800; outline: none; }
	input:focus { border-color: #2e8acc; box-shadow: 0 0 0 3px rgba(46, 138, 204, .16); }
	.error { margin: .55rem 0 0; color: #b2382e; font-size: .75rem; font-weight: 800; }
	:global(.submit) { margin-top: 1rem; }
	.privacy-note { display: flex; align-items: flex-start; gap: .35rem; margin-top: .9rem; color: #6a8496; font-size: .66rem; font-weight: 700; line-height: 1.45; }
</style>
