import { chapters } from './index';

const HARDWARE_MISSIONS: Record<string, string[]> = {
  ranger7: ['ch1_sites'],
  surveyor3: ['ch1_landing'],
  apollo11_descent: ['ch2_laser'],
  lrrr: ['ch2_laser', 'm5_laser'],
  apollo12_descent: ['ch2_apollo12'],
  alsep12: ['ch2_alsep'],
  apollo15_descent: ['ch2_lrv'],
  lrv16: ['ch2_lrv_extra'],
  lrv17: ['ch2_lrv_extra'],
  pioneer10: ['ch3_slingshot'],
  pioneer11: ['ch3_slingshot'],
  voyager2: ['ch3_slingshot'],
  viking1: ['ch4_landing', 'ch4_lr'],
  viking2: ['ch4_viking2'],
  pathfinder: ['ch5_opportunity'],
  sojourner: ['ch5_opportunity'],
  opportunity: ['ch5_opportunity'],
  spirit: ['ch5_spirit'],
  phoenix: ['ch5_newlanders'],
  insight: ['ch5_newlanders'],
  curiosity: ['ch6_perseverance'],
  perseverance: ['ch6_perseverance'],
  ingenuity: ['ch6_ingenuity'],
  voyager1: ['ch7_golden'],
  new_horizons: ['ch7_golden'],
  dawn: ['ch7_dawn'],
  near_shoemaker: ['ch7_near'],
  kepler: ['ch7_kepler'],
  lrv: ['m1_drive'],
};

const chapterMissionsByHardware: Record<string, string[]> = {};
for (const chapter of chapters) {
  const missionIds = chapter.beats.flatMap((b) => (b.kind === 'mission' ? [b.id] : []));
  for (const beat of chapter.beats) {
    if (beat.kind === 'memory') chapterMissionsByHardware[beat.hardware] = missionIds;
  }
}

export function missionIdsForHardware(hardwareId: string): string[] {
  return HARDWARE_MISSIONS[hardwareId] ?? chapterMissionsByHardware[hardwareId] ?? [];
}

export function hardwareMastery(hardwareId: string, starsByMission: Record<string, number>): { stars: number; mastered: boolean } {
  const ids = missionIdsForHardware(hardwareId);
  const best = ids.reduce((max, id) => Math.max(max, starsByMission[id] ?? 0), 0);
  const clamped = Math.min(3, Math.max(0, best));
  return { stars: clamped, mastered: clamped >= 3 };
}
