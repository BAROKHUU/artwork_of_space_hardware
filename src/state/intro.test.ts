import { beforeEach, describe, expect, it } from 'vitest';
import { INTRO_SCENES, normalizeIntro, useGame } from './store';

describe('intro story progress', () => {
  beforeEach(() => useGame.getState().reset());

  it('cleans saved progress that is missing, old or hand-edited', () => {
    expect(normalizeIntro(undefined)).toEqual({ scene: 0, finished: false });
    expect(normalizeIntro({ scene: 7, finished: true })).toEqual({ scene: 7, finished: true });
    expect(normalizeIntro({ scene: 99, finished: 'yes' })).toEqual({ scene: 0, finished: false });
    expect(normalizeIntro({ scene: 2.5 })).toEqual({ scene: 0, finished: false });
  });

  it('remembers the last scene and ignores invalid ones', () => {
    useGame.getState().setIntroScene(5);
    expect(useGame.getState().intro).toEqual({ scene: 5, finished: false });
    useGame.getState().setIntroScene(-1);
    useGame.getState().setIntroScene(INTRO_SCENES);
    expect(useGame.getState().intro.scene).toBe(5);
  });

  it('counts reaching the last scene, or pressing Keep exploring, as finished', () => {
    useGame.getState().setIntroScene(INTRO_SCENES - 1);
    expect(useGame.getState().intro.finished).toBe(true);
    useGame.getState().setIntroScene(3);
    expect(useGame.getState().intro).toEqual({ scene: 3, finished: true });
    useGame.getState().reset();
    useGame.getState().finishIntro();
    expect(useGame.getState().intro.finished).toBe(true);
  });
});
