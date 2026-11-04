import { useMemo } from 'react';
import { useData } from './store';
import { exerciseMap } from './exercises';
import { computeGame, type GameState } from './engine';
import { today } from './util';
import type { AppData, Exercise } from './types';

export function useExerciseMap(): Map<string, Exercise> {
  const data = useData();
  const custom = data.customExercises;
  return useMemo(() => exerciseMap({ ...data, customExercises: custom }), [custom]); // only custom exercises matter
}

const cache = new WeakMap<AppData, { day: string; game: GameState }>();

/** One computed game per data object, shared by every component. Also refreshed when the day changes. */
export function gameFor(data: AppData): GameState {
  const day = today();
  const hit = cache.get(data);
  if (hit?.day === day) return hit.game;
  const game = computeGame(data, exerciseMap(data));
  cache.set(data, { day, game });
  return game;
}

export function useGame(): GameState {
  return gameFor(useData());
}

export function settingFor(data: AppData, exerciseId: string): string {
  return data.exerciseSettings.find((s) => s.id === exerciseId && !s.deleted)?.note ?? '';
}
