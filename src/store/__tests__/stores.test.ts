import { beforeEach, describe, expect, it } from 'vitest';

import type { RouteData } from '@/lib/exile-leveling';
import { AppScanningState, AppState, useAppStore } from '../app.store';
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
