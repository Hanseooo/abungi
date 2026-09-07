import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { useAppStore } from './appStore';
import { TitleScreen } from '../features/title/TitleScreen';
import { PartySelectScreen } from '../features/party-select/PartySelectScreen';
import { RouteScreen } from '../features/route/RouteScreen';
import { BattleScreen } from '../features/battle/BattleScreen';
import { RewardScreen } from '../features/reward/RewardScreen';
import { ShopScreen } from '../features/shop/ShopScreen';
import { RestScreen } from '../features/rest/RestScreen';
import { EventScreen } from '../features/event/EventScreen';
import { ResultsScreen } from '../features/results/ResultsScreen';
import { audioEngine } from '../services/audio/audioEngine';
import { PaperButton } from '../ui/components/PaperButton';
import { GlobalOverlay } from '../ui/overlays/GlobalOverlay';
import { SceneOverlay } from '../features/scenes/SceneOverlay';

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Abungi render error', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="fatal-screen"><section className="fatal-card"><span className="tape-label">THE TABLE JAMMED</span><h1>Abungi hit a display error.</h1><p>Your committed run is saved locally when possible. Reloading is the safest recovery.</p><details><summary>Technical detail</summary><code>{this.state.error.message}</code></details><PaperButton variant="ink" onClick={() => location.reload()}>RELOAD ABUNGI</PaperButton></section></main>;
  }
}

function ScreenRouter() {
  const screen = useAppStore(state => state.screen);
  const screens = useMemo(() => ({
    title: <TitleScreen />,
    party: <PartySelectScreen />,
    route: <RouteScreen />,
    battle: <BattleScreen />,
    reward: <RewardScreen />,
    shop: <ShopScreen />,
    rest: <RestScreen />,
    event: <EventScreen />,
    results: <ResultsScreen />,
  }), []);
  return screens[screen];
}

function PwaUpdateNotice() {
  const screen = useAppStore(state => state.screen);
  const isResolving = useAppStore(state => state.isResolving);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh() { setNeedRefresh(true); },
      onOfflineReady() { setOfflineReady(true); window.setTimeout(() => setOfflineReady(false), 4500); },
      onRegisteredSW(_url, registration) {
        if (registration) window.setInterval(() => void registration.update(), 60 * 60 * 1000);
      },
      onRegisterError(error) { console.warn('Service worker registration failed; Abungi remains playable online.', error); },
    });
    setUpdateSW(() => update);
  }, []);

  const safeToReload = screen !== 'battle' && !isResolving;
  if (!needRefresh && !offlineReady) return null;
  return <aside className="pwa-toast" role="status" aria-live="polite">
    {offlineReady && !needRefresh && <><strong>OFFLINE READY</strong><span>Abungi is cached for play without a connection.</span></>}
    {needRefresh && <><strong>NEW CUT AVAILABLE</strong><span>{safeToReload ? 'Update now, or keep playing this version.' : 'Finish this battle first; the update will wait.'}</span><div>{safeToReload && <button onClick={() => void updateSW?.(true)}>UPDATE & RELOAD</button>}<button onClick={() => setNeedRefresh(false)}>LATER</button></div></>}
  </aside>;
}

function GlobalLifecycle() {
  const initialize = useAppStore(state => state.initialize);
  const settings = useAppStore(state => state.settings);
  const screen = useAppStore(state => state.screen);
  const run = useAppStore(state => state.run);
  const error = useAppStore(state => state.error);

  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => { audioEngine.configure(settings); }, [settings]);
  useEffect(() => {
    const unlock = () => { audioEngine.unlock(); document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); };
    const uiClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('button') : null;
      if(target instanceof HTMLButtonElement && !target.disabled) void audioEngine.sfx('ui-click');
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('click', uiClick);
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); document.removeEventListener('click', uiClick); };
  }, []);
  useEffect(() => { if(error) void audioEngine.sfx('error'); }, [error]);
  useEffect(() => {
    if (screen === 'battle' && run?.activeBattle) {
      void audioEngine.musicTrack(run.activeBattle.tier === 'boss' ? 'boss-music' : 'battle-music');
    } else {
      audioEngine.stopMusic();
    }
  }, [screen, run?.activeBattle?.id, run?.activeBattle?.tier]);
  return null;
}

export function App() {
  return <AppErrorBoundary><div className="app-shell"><GlobalLifecycle /><ScreenRouter /><GlobalOverlay /><SceneOverlay /><PwaUpdateNotice /></div></AppErrorBoundary>;
}
