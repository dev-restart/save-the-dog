<script lang="ts">
	import { onMount } from 'svelte';
	import QRCode from 'qrcode';
	import { Check, Copy, Link, QrCode, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { encodeStageMapQrShare, type StageMapDocument } from '$lib/game/stages/stage-map-schema.js';

	interface Props {
		document: StageMapDocument;
		onClose: () => void;
	}

	let { document, onClose }: Props = $props();
	let qrImage = $state<string | null>(null);
	let shareUrl = $state('');
	let error = $state('');
	let copied = $state(false);
	let shareCode = $derived(encodeStageMapQrShare(document));

	onMount(() => {
		shareUrl = `${window.location.origin}/?custom-map=${encodeURIComponent(shareCode)}`;
		void QRCode.toDataURL(shareUrl, {
			width: 288,
			margin: 1,
			errorCorrectionLevel: 'M',
			color: { dark: '#102239', light: '#ffffff' }
		})
			.then((value) => (qrImage = value))
			.catch(() => (error = '이 지도는 QR 용량을 초과했습니다. 공유 코드를 복사해 전달하세요.'));
	});

	async function copyShareUrl(): Promise<void> {
		try {
			await navigator.clipboard.writeText(shareUrl || shareCode);
			copied = true;
			window.setTimeout(() => (copied = false), 1600);
		} catch {
			error = '클립보드에 복사하지 못했습니다.';
		}
	}
</script>

<div class="share-backdrop" role="dialog" aria-modal="true" aria-label="지도 공유">
	<div class="share-panel">
		<header class="share-header">
			<div>
				<div class="share-eyebrow"><QrCode class="size-4" /> 지도 공유</div>
				<h2>{document.title}</h2>
			</div>
			<Button variant="ghost" size="icon-sm" aria-label="공유 닫기" onclick={onClose}>
				<X class="size-4" />
			</Button>
		</header>

		{#if qrImage}
			<img class="qr-image" src={qrImage} alt={`${document.title} QR 코드`} />
		{:else if !error}
			<div class="qr-loading" aria-live="polite">QR 코드 생성 중</div>
		{/if}

		{#if error}
			<p class="share-error" role="alert">{error}</p>
		{/if}

		<label class="share-code-label" for="map-share-code">공유 코드</label>
		<textarea id="map-share-code" class="share-code" readonly value={shareUrl || shareCode}></textarea>
		<Button class="h-11 w-full font-black" onclick={copyShareUrl}>
			{#if copied}
				<Check class="size-4" /> 복사됨
			{:else}
				<Copy class="size-4" /> 공유 코드 복사
			{/if}
		</Button>
		<div class="share-footnote"><Link class="size-3.5" /> QR 스캔 또는 코드 붙여넣기로 내 지도에 추가됩니다.</div>
	</div>
</div>

<style>
	.share-backdrop {
		position: absolute;
		inset: 0;
		z-index: 50;
		display: grid;
		place-items: center;
		padding: 1.25rem;
		background: rgba(8, 19, 34, 0.68);
		backdrop-filter: blur(8px);
	}

	.share-panel {
		width: min(100%, 23rem);
		border: 1px solid rgba(255, 255, 255, 0.8);
		border-radius: 8px;
		background: #f7fbff;
		padding: 1rem;
		box-shadow: 0 20px 50px rgba(4, 17, 32, 0.34);
		color: #102239;
	}

	.share-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.share-eyebrow,
	.share-footnote {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		font-weight: 800;
		color: #4a6077;
	}

	h2 {
		margin: 0.2rem 0 0;
		font-size: 1.1rem;
		font-weight: 900;
	}

	.qr-image,
	.qr-loading {
		display: block;
		width: 12rem;
		height: 12rem;
		margin: 0.9rem auto;
		border: 1px solid #d6e1ec;
		border-radius: 4px;
		background: white;
	}

	.qr-loading {
		display: grid;
		place-items: center;
		font-size: 0.8rem;
		font-weight: 800;
		color: #526a82;
	}

	.share-code-label {
		display: block;
		margin-bottom: 0.35rem;
		font-size: 0.78rem;
		font-weight: 900;
	}

	.share-code {
		width: 100%;
		height: 4.75rem;
		resize: none;
		border: 1px solid #c6d7e7;
		border-radius: 4px;
		background: #edf5fc;
		padding: 0.55rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.65rem;
		line-height: 1.35;
		color: #263b50;
	}

	.share-panel :global(button) {
		margin-top: 0.6rem;
	}

	.share-footnote {
		margin-top: 0.7rem;
	}

	.share-error {
		margin: 0.8rem 0;
		border-left: 3px solid #e55743;
		padding-left: 0.6rem;
		font-size: 0.78rem;
		font-weight: 700;
		color: #a23527;
	}
</style>
