import { useMemo } from 'react';
import { useData } from './store';
import { exerciseMap } from './exercises';
import { computeGame, type GameState } from './xp';
import type { AppData, Exercise } from './types';

export function useExerciseMap(): Map<string, Exercise> {
  const data = useData();
  const custom = data.customExercises;
  return useMemo(() => exerciseMap({ ...data, customExercises: custom }), [custom]); // only custom exercises matter
}

export function useGame(): GameState {
  const data = useData();
  const exMap = useExerciseMap();
  return useMemo(() => computeGame(data, exMap), [data, exMap]);
}

export function computeFor(data: AppData, exMap: Map<string, Exercise>): GameState {
  return computeGame(data, exMap);
}

export function settingFor(data: AppData, exerciseId: string): string {
  return data.exerciseSettings.find((s) => s.id === exerciseId && !s.deleted)?.note ?? '';
}
