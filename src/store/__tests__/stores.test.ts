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

  it('switches the state', () => {
    useAppStore.getState().setAppState(AppState.IN_GAME);
    expect(useAppStore.getState().appState).toBe(AppState.IN_GAME);
  });

  it('switches the scanning state', () => {
    useAppStore.getState().setAppScanningState(AppScanningState.SCANNING);
    expect(useAppStore.getState().appScanningState).toBe(
      AppScanningState.SCANNING
    );
  });

  it('remembers an available update', () => {
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

  it('takes route and sha', () => {
    useRouteStore.getState().setRoute(route, 'abc1234');

    expect(useRouteStore.getState().route).toBe(route);
    expect(useRouteStore.getState().sha).toBe('abc1234');
  });

  it('remembers the zone for the edge', () => {
    useRouteStore.getState().setRoute(route, 'abc1234');
    useRouteStore.getState().setCurrentEdge(1);

    expect(useRouteStore.getState().currentEdge).toBe(1);
    expect(useRouteStore.getState().currentAreaId).toBe('1_1_town');
  });

  it('sets the zone to null when the edge does not exist', () => {
    useRouteStore.getState().setRoute(route, 'abc1234');
    useRouteStore.getState().setCurrentEdge(99);

    expect(useRouteStore.getState().currentAreaId).toBeNull();
  });

  it('sets the zone to null while no route is loaded', () => {
    useRouteStore.getState().setCurrentEdge(3);

    expect(useRouteStore.getState().currentEdge).toBe(3);
    expect(useRouteStore.getState().currentAreaId).toBeNull();
  });

  it('keeps error state and message together', () => {
    useRouteStore.getState().setSyncState('error', 'no network');

    expect(useRouteStore.getState().syncState).toBe('error');
    expect(useRouteStore.getState().syncError).toBe('no network');
  });

  it('clears the message when no reason comes along', () => {
    useRouteStore.getState().setSyncState('error', 'no network');
    useRouteStore.getState().setSyncState('idle');

    expect(useRouteStore.getState().syncError).toBeNull();
  });
});

describe('settings.store', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetOverlayPlacement();
    useSettingsStore.setState({ clientTxtPath: '' });
  });

  it('holds the Client.txt path', () => {
    useSettingsStore.getState().setClientTxtPath('C:/poe/Client.txt');
    expect(useSettingsStore.getState().clientTxtPath).toBe('C:/poe/Client.txt');
  });

  it('takes scale, opacity, offset and anchor', () => {
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

  it('resets the placement but leaves the path', () => {
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

  it('starts in the previous flow', () => {
    expect(useGuideStore.getState().mode).toBe('league-start');
  });

  it('switches the mode', () => {
    useGuideStore.getState().setMode('speedleveling');
    expect(useGuideStore.getState().mode).toBe('speedleveling');
  });

  it('records the time of the start', () => {
    // NewRunDialog measures the pause since the last start against this.
    useGuideStore.getState().markOpened(1_700_000_000_000);
    expect(useGuideStore.getState().lastOpenedAt).toBe(1_700_000_000_000);
  });
});

describe('route.store, who persists progress', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    localStorage.removeItem('route');
  });

  it('the main window stores it', async () => {
    localStorage.removeItem('route');
    vi.resetModules();

    const { useRouteStore: store } = await import('../route.store');
    store.getState().setCurrentEdge(7);

    expect(JSON.parse(localStorage.getItem('route')!).state.currentEdge).toBe(7);
  });

  it('the overlay stores nothing', async () => {
    // It computes the zone from its own route. If it ever held a different
    // mode again, it would overwrite the main window's state with it and
    // shift its progress on the next start.
    localStorage.removeItem('route');
    vi.stubGlobal('location', { hash: '#/overlay' });
    vi.resetModules();

    const { useRouteStore: store } = await import('../route.store');
    store.getState().setCurrentEdge(7);

    expect(store.getState().currentEdge).toBe(7);
    expect(localStorage.getItem('route')).toBeNull();
  });

  it('the overlay does not read what is already there either', async () => {
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

describe('settings.store, who persists the settings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    localStorage.removeItem('settings');
  });

  it('the main window stores them', async () => {
    localStorage.removeItem('settings');
    vi.resetModules();

    const { useSettingsStore: store } = await import('../settings.store');
    store.getState().setOverlayOpacity(0.8);

    expect(
      JSON.parse(localStorage.getItem('settings')!).state.overlayOpacity
    ).toBe(0.8);
  });

  it('the overlay stores nothing although dragging and scaling happen there', async () => {
    // Measured before this existed: move the overlay, then touch a slider in
    // the main window, and the offset was gone. The main window never knew
    // it and wrote its own state over it.
    localStorage.removeItem('settings');
    vi.stubGlobal('location', { hash: '#/overlay' });
    vi.resetModules();

    const { useSettingsStore: store } = await import('../settings.store');
    store.getState().setOverlayOffset({ dx: 0.3, dy: 0.2 });

    expect(store.getState().overlayOffset).toEqual({ dx: 0.3, dy: 0.2 });
    expect(localStorage.getItem('settings')).toBeNull();
  });
});
