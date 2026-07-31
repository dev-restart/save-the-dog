<script lang="ts">
  import {
    CheckCircle2,
    FolderOpen,
    Lock,
    Map,
    Palette,
    Play,
    RotateCcw,
    Settings,
    SquarePen,
    Star,
    Trophy,
    X,
  } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { SKINS } from "$lib/game/skins.js";
  import type { SkinId } from "$lib/game/types.js";

  interface Props {
    highestStage: number;
    totalClears: number;
    totalStars: number;
    stageStars: Record<string, number>;
    canContinue: boolean;
    skin: SkinId;
    hapticsEnabled: boolean;
    musicEnabled: boolean;
    sfxEnabled: boolean;
    onStart: () => void;
    onContinue: () => void;
    onStageSelect: (stage: number) => void;
    onSkinChange: (skin: SkinId) => void;
    onHapticsChange: (enabled: boolean) => void;
    onMusicChange: (enabled: boolean) => void;
    onSfxChange: (enabled: boolean) => void;
    onMapCreate: () => void;
    onMapLibrary: () => void;
  }

  let {
    highestStage,
    totalClears,
    totalStars,
    stageStars,
    canContinue,
    skin,
    hapticsEnabled,
    musicEnabled,
    sfxEnabled,
    onStart,
    onContinue,
    onStageSelect,
    onSkinChange,
    onHapticsChange,
    onMusicChange,
    onSfxChange,
    onMapCreate,
    onMapLibrary,
  }: Props = $props();

  let selectedSkin = $derived(
    SKINS.find((option) => option.id === skin) ?? SKINS[0],
  );
  let dogPreviewSrc = $derived(selectedSkin.assets.dog);
  let beePreviewSrc = $derived(selectedSkin.assets.bee);
  let introBackgroundSrc = $derived(selectedSkin.menu.introBackground);
  let introTitleSrc = $derived(selectedSkin.menu.introTitle);
  let showStageMap = $state(false);
  let showSettings = $state(false);
  let continueStage = $derived(Math.max(1, highestStage));
  let stageMapLimit = $derived(Math.max(20, continueStage + 4));
  let stageMapItems = $derived(
    Array.from({ length: stageMapLimit }, (_, index) => index + 1),
  );

  function selectStage(stage: number): void {
    if (stage > highestStage) return;
    onStageSelect(stage);
  }

  function closeSettings(): void {
    showSettings = false;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    if (showSettings) closeSettings();
    else if (showStageMap) showStageMap = false;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<section
  class="menu-screen relative flex size-full flex-col overflow-hidden px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.4rem,env(safe-area-inset-top))] text-slate-950"
  data-skin={skin}
>
  <img
    class="intro-bg absolute inset-0 size-full object-cover"
    src={introBackgroundSrc}
    alt=""
    aria-hidden="true"
  />

  <div class="topbar relative z-10 flex items-center justify-between gap-2">
    <div class="hud-stats" aria-label="플레이 기록">
      <button
        class="hud-chip hud-chip-button"
        type="button"
        aria-expanded={showStageMap}
        onclick={() => (showStageMap = true)}
      >
        <Trophy class="size-3.5 text-amber-500" />
        <span>{continueStage}단계</span>
      </button>
      <div class="hud-chip">
        <CheckCircle2 class="size-3.5" />
        <span>클리어 {totalClears}</span>
      </div>
      <div class="hud-chip">
        <Star class="size-3.5 fill-amber-400 text-amber-500" />
        <span>별 {totalStars.toFixed(1)}</span>
      </div>
    </div>
    <button
      class="settings-button"
      type="button"
      aria-label="설정 열기"
      aria-expanded={showSettings}
      onclick={() => (showSettings = !showSettings)}
    >
      <Settings class="size-5" />
    </button>
  </div>

  <div class="title-zone relative z-10">
    <img
      class="title-graphic"
      src={introTitleSrc}
      alt="Save The Dog - Draw Block Survive"
    />
  </div>

  <div class="hero-zone relative z-10 flex flex-1 items-center justify-center">
    <div class="hero-sprites relative">
      <div class="hero-glow"></div>
      <img class="dog-preview absolute" src={dogPreviewSrc} alt="" />
      <img class="bee-preview absolute" src={beePreviewSrc} alt="" />
      <div class="hero-shadow absolute"></div>
    </div>
  </div>

  <div class="menu-actions relative z-10 grid gap-3">
    <div class="skin-panel">
      <div class="mb-2 flex items-center gap-1 text-xs font-black">
        <Palette class="size-4" />
        게임 디자인
      </div>
      <div class="grid grid-cols-3 gap-1">
        {#each SKINS as option (option.id)}
          <Button
            type="button"
            variant={skin === option.id ? "default" : "secondary"}
            size="sm"
            class="skin-button h-9 px-1 text-[11px] font-black"
            aria-pressed={skin === option.id}
            onclick={() => onSkinChange(option.id)}
          >
            {option.label}
          </Button>
        {/each}
      </div>
    </div>
    {#if canContinue}
      <Button
        size="lg"
        class="primary-action h-12 text-base font-black"
        onclick={onContinue}
      >
        <Play class="size-5" />
        {continueStage}단계 계속하기
      </Button>
    {/if}
    <Button
      variant={canContinue ? "secondary" : "default"}
      size="lg"
      class="secondary-action h-12 text-base font-black"
      onclick={onStart}
    >
      <RotateCcw class="size-5" />
      처음부터 시작
    </Button>
  </div>

  {#if showSettings}
    <div class="settings-modal-backdrop">
      <button
        class="settings-modal-dismiss"
        type="button"
        tabindex="-1"
        aria-label="설정 닫기"
        onclick={closeSettings}
      ></button>
      <dialog class="settings-panel" open aria-modal="true" aria-label="설정">
        <div class="mb-3 flex items-center justify-between gap-2">
          <div class="flex items-center gap-1 text-sm font-black text-slate-900">
            <Settings class="size-4" />
            설정
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="설정 닫기"
            onclick={closeSettings}
          >
            <X class="size-4" />
          </Button>
        </div>
        <div class="settings-map-section" aria-label="사용자 지도">
          <div class="settings-title">사용자 지도</div>
          <div class="settings-map-actions">
            <Button variant="secondary" class="settings-map-button h-10 text-xs font-black" onclick={onMapCreate}>
              <SquarePen class="size-4" />
              지도 만들기
            </Button>
            <Button variant="secondary" class="settings-map-button h-10 text-xs font-black" onclick={onMapLibrary}>
              <FolderOpen class="size-4" />
              지도 불러오기
            </Button>
          </div>
        </div>
        <div class="settings-item">
          <div>
            <div class="settings-title">배경음악</div>
            <div class="settings-description">스킨별 음악을 메뉴와 게임 중에 재생합니다.</div>
          </div>
          <button
            type="button"
            class="haptic-toggle settings-toggle"
            aria-pressed={musicEnabled}
            onclick={() => onMusicChange(!musicEnabled)}
          >
            <span>{musicEnabled ? '음악 켜짐' : '음악 꺼짐'}</span>
            <span class="haptic-switch" class:haptic-switch-on={musicEnabled}></span>
          </button>
        </div>
        <div class="settings-item">
          <div>
            <div class="settings-title">효과음</div>
            <div class="settings-description">벌 윙윙 소리와 방어막 충돌음을 재생합니다.</div>
          </div>
          <button
            type="button"
            class="haptic-toggle settings-toggle"
            aria-pressed={sfxEnabled}
            onclick={() => onSfxChange(!sfxEnabled)}
          >
            <span>{sfxEnabled ? '효과음 켜짐' : '효과음 꺼짐'}</span>
            <span class="haptic-switch" class:haptic-switch-on={sfxEnabled}></span>
          </button>
        </div>
        <div class="settings-item">
          <div>
            <div class="settings-title">햅틱 설정</div>
            <div class="settings-description">벌이 강아지를 공격할 때 진동합니다.</div>
          </div>
          <button
            type="button"
            class="haptic-toggle settings-toggle"
            aria-pressed={hapticsEnabled}
            onclick={() => onHapticsChange(!hapticsEnabled)}
          >
            <span>{hapticsEnabled ? '진동 켜짐' : '진동 꺼짐'}</span>
            <span class="haptic-switch" class:haptic-switch-on={hapticsEnabled}></span>
          </button>
        </div>
      </dialog>
    </div>
  {/if}

  {#if showStageMap}
    <div
      class="stage-map-backdrop relative z-20"
      role="dialog"
      aria-modal="true"
      aria-label="스테이지 선택"
    >
      <div class="stage-map-panel">
        <div class="mb-3 flex items-center justify-between gap-2">
          <div>
            <div
              class="flex items-center gap-1 text-sm font-black text-slate-900"
            >
              <Map class="size-4" />
              스테이지 선택
            </div>
            <p class="mt-1 text-[11px] font-semibold text-slate-600">
              열린 단계만 선택할 수 있습니다.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="스테이지 선택 닫기"
            onclick={() => (showStageMap = false)}
          >
            <X class="size-4" />
          </Button>
        </div>
        <div class="stage-grid">
          {#each stageMapItems as stageId (stageId)}
            {@const unlocked = stageId <= highestStage}
            {@const stars = stageStars[String(stageId)] ?? 0}
            <button
              type="button"
              class="stage-node"
              class:stage-node-current={stageId === continueStage}
              class:stage-node-cleared={stars > 0 || stageId < highestStage}
              class:stage-node-locked={!unlocked}
              disabled={!unlocked}
              aria-label={unlocked
                ? `${stageId}단계 선택`
                : `${stageId}단계 잠김`}
              onclick={() => selectStage(stageId)}
            >
              {#if unlocked}
                <span class="stage-number">{stageId}</span>
                <span class="stage-stars">★ {stars.toFixed(1)}</span>
              {:else}
                <Lock class="size-4" />
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</section>

<style>
  .menu-screen {
    --panel-bg: rgba(255, 255, 255, 0.78);
    --panel-border: rgba(255, 255, 255, 0.9);
    --panel-text: #26364d;
    --selected-bg: #151515;
    --selected-text: #ffffff;
    --secondary-bg: rgba(255, 255, 255, 0.88);
    --secondary-text: #171717;
    --action-bg: #151515;
    --action-text: #ffffff;
    --shadow: rgba(15, 23, 42, 0.22);
  }

  .menu-screen::before {
    position: absolute;
    inset: 0;
    z-index: 1;
    content: "";
    background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.1) 0%,
        rgba(255, 255, 255, 0) 35%
      ),
      linear-gradient(
        180deg,
        rgba(15, 23, 42, 0) 43%,
        rgba(15, 23, 42, 0.2) 70%,
        rgba(15, 23, 42, 0.36) 100%
      );
    pointer-events: none;
  }

  .menu-screen[data-skin="minecraft"] {
    --panel-bg: rgba(36, 56, 31, 0.78);
    --panel-border: rgba(201, 255, 150, 0.55);
    --panel-text: #f4ffe5;
    --selected-bg: #2f7d2f;
    --selected-text: #ffffff;
    --secondary-bg: rgba(238, 255, 216, 0.9);
    --secondary-text: #244319;
    --action-bg: #3f250e;
    --action-text: #fff7c2;
    --shadow: rgba(47, 29, 14, 0.38);
  }

  .menu-screen[data-skin="lego"] {
    --panel-bg: rgba(255, 255, 255, 0.78);
    --panel-border: rgba(255, 255, 255, 0.95);
    --panel-text: #17324d;
    --selected-bg: #d7261f;
    --selected-text: #ffffff;
    --secondary-bg: rgba(255, 255, 255, 0.9);
    --secondary-text: #1f2937;
    --action-bg: #0b4c9c;
    --action-text: #ffffff;
    --shadow: rgba(17, 24, 39, 0.28);
  }

  .intro-bg {
    z-index: 0;
    transform: scale(1.01);
  }

  .topbar,
  .title-zone,
  .hero-zone,
  .menu-actions {
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.28);
  }

  .hud-stats {
    display: inline-flex;
    max-width: 100%;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid var(--panel-border);
    border-radius: 999px;
    border-color: var(--panel-border);
    background: var(--panel-bg);
    padding: 0.25rem;
    box-shadow: 0 7px 18px var(--shadow);
    color: var(--panel-text);
    backdrop-filter: blur(10px);
  }

  .hud-chip {
    display: inline-flex;
    min-width: 0;
    height: 28px;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.32);
    padding: 0 0.55rem;
    font-size: 0.72rem;
    font-weight: 900;
    line-height: 1;
    white-space: nowrap;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
  }

  .hud-chip-button {
    cursor: pointer;
    transition:
      transform 120ms ease,
      background 120ms ease;
  }

  .hud-chip-button:active {
    transform: scale(0.96);
  }

  .settings-button {
    display: inline-flex;
    width: 42px;
    height: 42px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--panel-border);
    border-radius: 999px;
    background: var(--panel-bg);
    color: var(--panel-text);
    box-shadow: 0 7px 18px var(--shadow);
    backdrop-filter: blur(10px);
    transition:
      transform 120ms ease,
      background 120ms ease;
  }

  .settings-button:active {
    transform: scale(0.94);
  }

  .settings-modal-backdrop {
    position: absolute;
    z-index: 30;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 1.25rem;
    background: rgba(2, 6, 23, 0.58);
    backdrop-filter: blur(3px);
  }

  .settings-modal-dismiss {
    position: absolute;
    inset: 0;
    border: 0;
    background: transparent;
    cursor: default;
  }

  .settings-panel {
    position: relative;
    z-index: 1;
    margin: 0;
    width: min(100%, 340px);
    max-height: calc(100% - 2.5rem);
    overflow-y: auto;
    border: 1px solid var(--panel-border);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.93);
    padding: 0.9rem;
    color: #1e293b;
    box-shadow: 0 18px 36px rgba(15, 23, 42, 0.28);
    backdrop-filter: blur(14px);
  }

  .settings-map-section {
    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    padding-bottom: 0.8rem;
  }

  .settings-map-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem;
    margin-top: 0.45rem;
  }

  :global(.settings-map-button) {
    border: 1px solid rgba(30, 64, 96, 0.16);
    border-radius: 10px;
    background: #eef7ff;
    color: #243a54;
  }

  .settings-item {
    display: grid;
    gap: 0.65rem;
    padding-top: 0.7rem;
  }

  .settings-item + .settings-item {
    margin-top: 0.7rem;
    border-top: 1px solid rgba(15, 23, 42, 0.08);
  }

  .settings-title {
    font-size: 0.9rem;
    font-weight: 900;
  }

  .settings-description {
    margin-top: 0.15rem;
    color: #64748b;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .stage-map-backdrop {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 1rem;
    background: linear-gradient(
      180deg,
      rgba(15, 23, 42, 0.08),
      rgba(15, 23, 42, 0.48)
    );
  }

  .stage-map-panel {
    width: min(100%, 410px);
    max-height: min(70vh, 540px);
    overflow: auto;
    border: 1px solid var(--panel-border);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.92);
    padding: 1rem;
    box-shadow: 0 18px 36px rgba(15, 23, 42, 0.28);
    backdrop-filter: blur(14px);
  }

  .stage-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.45rem;
  }

  .stage-node {
    display: grid;
    min-height: 52px;
    place-items: center;
    gap: 0.1rem;
    border: 1px solid rgba(15, 23, 42, 0.1);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.8);
    color: #1e293b;
    font-weight: 900;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
  }

  .stage-node-cleared {
    border-color: rgba(245, 158, 11, 0.38);
    background: #fff7d6;
  }

  .stage-node-current {
    border-color: rgba(21, 21, 21, 0.4);
    background: var(--action-bg);
    color: var(--action-text);
    box-shadow: 0 8px 16px var(--shadow);
  }

  .stage-node-locked {
    cursor: not-allowed;
    background: rgba(226, 232, 240, 0.72);
    color: #94a3b8;
  }

  .stage-number {
    font-size: 0.9rem;
    line-height: 1;
  }

  .stage-stars {
    font-size: 0.58rem;
    line-height: 1;
    opacity: 0.82;
  }

  .title-zone {
    margin-top: clamp(1.2rem, 4vh, 3rem);
  }

  .title-graphic {
    width: min(100%, 430px);
    height: auto;
    filter: drop-shadow(0 14px 16px var(--shadow));
  }

  .hero-zone {
    min-height: 190px;
  }

  .hero-sprites {
    width: min(76vw, 280px);
    aspect-ratio: 1.35;
  }

  .hero-glow {
    position: absolute;
    inset: 12% 5% 4%;
    border-radius: 999px;
    background: radial-gradient(
      circle,
      rgba(255, 255, 255, 0.48),
      rgba(255, 255, 255, 0) 65%
    );
    filter: blur(2px);
  }

  .dog-preview {
    left: 8%;
    top: 13%;
    width: 54%;
    filter: drop-shadow(0 18px 13px var(--shadow));
  }

  .bee-preview {
    right: 2%;
    top: 22%;
    width: 43%;
    transform: rotate(8deg);
    filter: drop-shadow(0 13px 11px var(--shadow));
  }

  .hero-shadow {
    left: 9%;
    right: 9%;
    bottom: 5%;
    height: 18px;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.18);
    filter: blur(8px);
  }

  .menu-actions {
    margin-top: auto;
    padding-bottom: 0.45rem;
  }

  .skin-panel {
    border: 1px solid var(--panel-border);
    border-radius: 16px;
    background: var(--panel-bg);
    padding: 0.75rem;
    color: var(--panel-text);
    box-shadow: 0 12px 24px var(--shadow);
    backdrop-filter: blur(12px);
  }

  :global(.skin-button[aria-pressed="true"]) {
    background: var(--selected-bg);
    color: var(--selected-text);
    box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.16);
  }

  :global(.skin-button[aria-pressed="false"]) {
    background: var(--secondary-bg);
    color: var(--secondary-text);
  }

  .haptic-toggle {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-radius: 12px;
    background: var(--secondary-bg);
    padding: 0.55rem 0.65rem;
    color: var(--secondary-text);
    font-size: 0.78rem;
    font-weight: 900;
  }

  .settings-toggle {
    min-height: 44px;
  }

  .haptic-switch {
    position: relative;
    width: 2.35rem;
    height: 1.25rem;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.25);
    transition: background 0.16s ease;
  }

  .haptic-switch::after {
    position: absolute;
    top: 0.18rem;
    left: 0.18rem;
    width: 0.9rem;
    height: 0.9rem;
    border-radius: 999px;
    background: #fff;
    content: "";
    transition: transform 0.16s ease;
  }

  .haptic-switch-on {
    background: var(--selected-bg);
  }

  .haptic-switch-on::after {
    transform: translateX(1.1rem);
  }

  :global(.primary-action) {
    border-radius: 14px;
    background: var(--action-bg);
    color: var(--action-text);
    box-shadow: 0 12px 22px var(--shadow);
  }

  :global(.secondary-action) {
    border-radius: 14px;
    background: var(--secondary-bg);
    color: var(--secondary-text);
    box-shadow: 0 10px 20px var(--shadow);
  }

  @media (max-height: 720px) {
    .title-zone {
      margin-top: 0.7rem;
    }

    .title-graphic {
      width: min(92%, 360px);
    }

    .hero-zone {
      min-height: 140px;
    }

    .hero-sprites {
      width: min(68vw, 230px);
    }
  }

  @media (max-width: 360px) {
    .hud-chip {
      padding: 0 0.42rem;
      font-size: 0.66rem;
    }
  }
</style>
