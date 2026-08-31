import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RouteData } from '@/lib/exile-leveling';
import { AppScanningState, AppState, useAppStore } from '../app.store';
import { useGuideStore } from '../guide.store';
import { useRouteStore } from '../route.store';
import { useSettingsStore } from '../settings.store';

function step(edgeIndex: number | null): RouteData.FragmentStep {
  return { type: 'fragment_step', parts: ['x'], subSteps: [], edgeIndex };
}

const route: RouteData.Route = {
  sections: [{ name: 'Act 1', steps: [step(0), step(1)] }],
  edges: ['1_1_1', '1_1_town']
};

describe('app.store', () => {
  beforeEach(() => {
    useAppStore.setState({
      appState: AppState.NORMAL,
      appScanningState: AppScanningState.NOT_SCANNING,
      newUpdateAvailable: false
    });
  });

  it('schaltet den Zustand um', () => {
    useAppStore.getState().setAppState(AppState.IN_GAME);
    expect(useAppStore.getState().appState).toBe(AppState.IN_GAME);
  });

  it('schaltet den Scanzustand um', () => {
    useAppStore.getState().setAppScanningState(AppScanningState.SCANNING);
    expect(useAppStore.getState().appScanningState).toBe(
      AppScanningState.SCANNING
    );
  });

  it('merkt sich ein verfuegbares Update', () => {
    useAppStore.getState().setNewUpdateAvailable(true);
    expect(useAppStore.getState().newUpdateAvailable).toBe(true);
  });
});

describe('route.store', () => {
  beforeEach(() => {
    useRouteStore.setState({
      route: null,
      sha: null,
      currentEdge: 0,
      currentAreaId: null,
      syncState: 'idle',
      syncError: null
    });
  });

  it('nimmt Route und sha auf', () => {
    useRouteStore.getState().setRoute(route, 'abc1234');

    expect(useRouteStore.getState().route).toBe(route);
    expect(useRouteStore.getState().sha).toBe('abc1234');
  });

  it('merkt sich zur Kante die Zone', () => {
    useRouteStore.getState().setRoute(route, 'abc1234');
    useRouteStore.getState().setCurrentEdge(1);

    expect(useRouteStore.getState().currentEdge).toBe(1);
    expect(useRouteStore.getState().currentAreaId).toBe('1_1_town');
  });

  it('setzt die Zone auf null, wenn die Kante nicht existiert', () => {
    useRouteStore.getState().setRoute(route, 'abc1234');
    useRouteStore.getState().setCurrentEdge(99);

    expect(useRouteStore.getState().currentAreaId).toBeNull();
  });

  it('setzt die Zone auf null, solange keine Route geladen ist', () => {
    useRouteStore.getState().setCurrentEdge(3);

    expect(useRouteStore.getState().currentEdge).toBe(3);
    expect(useRouteStore.getState().currentAreaId).toBeNull();
  });

  it('haelt Fehlerzustand und Meldung zusammen', () => {
    useRouteStore.getState().setSyncState('error', 'kein Netz');

    expect(useRouteStore.getState().syncState).toBe('error');
    expect(useRouteStore.getState().syncError).toBe('kein Netz');
  });

  it('raeumt die Meldung weg, wenn kein Grund mitkommt', () => {
    useRouteStore.getState().setSyncState('error', 'kein Netz');
    useRouteStore.getState().setSyncState('idle');

    expect(useRouteStore.getState().syncError).toBeNull();
  });
});

describe('settings.store', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetOverlayPlacement();
    useSettingsStore.setState({ clientTxtPath: '' });
  });

  it('haelt den Client.txt-Pfad', () => {
    useSettingsStore.getState().setClientTxtPath('C:/poe/Client.txt');
    expect(useSettingsStore.getState().clientTxtPath).toBe('C:/poe/Client.txt');
  });

  it('nimmt Groesse, Deckkraft, Verschiebung und Anker auf', () => {
    const store = useSettingsStore.getState();
    store.setOverlayScale(1.4);
    store.setOverlayOpacity(0.8);
    store.setOverlayOffset({ dx: 0.1, dy: -0.2 });
    store.setOverlayAnchor('minimap');

    const after = useSettingsStore.getState();
    expect(after.overlayScale).toBe(1.4);
    expect(after.overlayOpacity).toBe(0.8);
    expect(after.overlayOffset).toEqual({ dx: 0.1, dy: -0.2 });
    expect(after.overlayAnchor).toBe('minimap');
  });

  it('setzt Platzierung zurueck, laesst den Pfad aber stehen', () => {
    const store = useSettingsStore.getState();
    store.setClientTxtPath('C:/poe/Client.txt');
    store.setOverlayScale(1.9);
    store.setOverlayOffset({ dx: 0.4, dy: 0.4 });

    useSettingsStore.getState().resetOverlayPlacement();

    const after = useSettingsStore.getState();
    expect(after.overlayScale).toBe(1);
    expect(after.overlayOffset).toEqual({ dx: 0, dy: 0 });
    expect(after.clientTxtPath).toBe('C:/poe/Client.txt');
  });
});

describe('guide.store', () => {
  beforeEach(() => {
    useGuideStore.setState({ mode: 'league-start', lastOpenedAt: null });
  });

  it('faengt im bisherigen Ablauf an', () => {
    expect(useGuideStore.getState().mode).toBe('league-start');
  });

  it('wechselt den Modus', () => {
    useGuideStore.getState().setMode('speedleveling');
    expect(useGuideStore.getState().mode).toBe('speedleveling');
  });

  it('haelt den Zeitpunkt des Starts fest', () => {
    // Daran misst NewRunDialog die Pause seit dem letzten Start.
    useGuideStore.getState().markOpened(1_700_000_000_000);
    expect(useGuideStore.getState().lastOpenedAt).toBe(1_700_000_000_000);
  });
});

describe('route.store, wer den Fortschritt speichert', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    localStorage.removeItem('route');
  });

  it('das Hauptfenster legt ihn ab', async () => {
    localStorage.removeItem('route');
    vi.resetModules();

    const { useRouteStore: store } = await import('../route.store');
    store.getState().setCurrentEdge(7);

    expect(JSON.parse(localStorage.getItem('route')!).state.currentEdge).toBe(7);
  });

  it('das Overlay legt nichts ab', async () => {
    // Es rechnet die Zone aus seiner eigenen Route aus. Hielte es je wieder
    // eine andere Lesart, wuerde es damit den Stand des Hauptfensters
    // ueberschreiben und dessen Fortschritt beim naechsten Start verschieben.
    localStorage.removeItem('route');
    vi.stubGlobal('location', { hash: '#/overlay' });
    vi.resetModules();

    const { useRouteStore: store } = await import('../route.store');
    store.getState().setCurrentEdge(7);

    expect(store.getState().currentEdge).toBe(7);
    expect(localStorage.getItem('route')).toBeNull();
  });

  it('das Overlay liest auch nichts, was schon dasteht', async () => {
    localStorage.setItem(
      'route',
      JSON.stringify({ state: { currentEdge: 99, currentAreaId: 'x' }, version: 2 })
    );
    vi.stubGlobal('location', { hash: '#/overlay' });
    vi.resetModules();

    const { useRouteStore: store } = await import('../route.store');

    expect(store.getState().currentEdge).toBe(0);
  });
});

describe('settings.store, wer die Einstellungen speichert', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    localStorage.removeItem('settings');
  });

  it('das Hauptfenster legt sie ab', async () => {
    localStorage.removeItem('settings');
    vi.resetModules();

    const { useSettingsStore: store } = await import('../settings.store');
    store.getState().setOverlayOpacity(0.8);

    expect(
      JSON.parse(localStorage.getItem('settings')!).state.overlayOpacity
    ).toBe(0.8);
  });

  it('das Overlay legt nichts ab, obwohl man dort zieht und skaliert', async () => {
    // Nachgemessen bevor es das gab: Overlay verschieben, danach im
    // Hauptfenster einen Regler anfassen, und die Verschiebung war weg. Das
    // Hauptfenster kannte sie nie und schrieb seinen eigenen Stand darueber.
    localStorage.removeItem('settings');
    vi.stubGlobal('location', { hash: '#/overlay' });
    vi.resetModules();

    const { useSettingsStore: store } = await import('../settings.store');
    store.getState().setOverlayOffset({ dx: 0.3, dy: 0.2 });

    expect(store.getState().overlayOffset).toEqual({ dx: 0.3, dy: 0.2 });
    expect(localStorage.getItem('settings')).toBeNull();
  });
});
