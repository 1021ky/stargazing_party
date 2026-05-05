#!/usr/bin/env node
/**
 * Phase B: 3地点でのデータ収集スクリプト
 * 
 * 大阪梅田駅、大阪なんば駅、奈良天川村の3地点で光害データを取得し、
 * DEBUG ログを確認できるようにします。
 * 
 * 使用方法:
 *   node tmp/phase-b-data-collection.mjs
 */

import { resolveLightPollution } from './src/lib/server/light_pollution_service.ts';

const testLocations = [
  {
    name: '大阪梅田駅',
    latitude: 34.7020,
    longitude: 135.4955,
    expectedBrightness: 'high',
  },
  {
    name: '大阪なんば駅',
    latitude: 34.6653,
    longitude: 135.5023,
    expectedBrightness: 'high',
  },
  {
    name: '奈良天川村',
    latitude: 34.1833,
    longitude: 136.0333,
    expectedBrightness: 'low',
  },
];

console.log('🌙 Phase B: Light Pollution Data Collection');
console.log('='.repeat(60));
console.log('');

async function collectData() {
  for (const location of testLocations) {
    console.log(`\n📍 ${location.name}`);
    console.log(`   座標: (${location.latitude}, ${location.longitude})`);
    console.log(`   予想: ${location.expectedBrightness}`);
    console.log('-'.repeat(60));

    try {
      // DEBUG ログ付きで光害データ取得
      const result = await resolveLightPollution({
        latitude: location.latitude,
        longitude: location.longitude,
        year: 2024,
      });

      console.log(`\n   📊 結果:`);
      console.log(`      光害値: ${result.lightPollutionProxy}`);
      console.log(`      分類: ${result.lightPollutionLevel}`);
      console.log(`      ソース: ${result.lightPollutionSource}`);
    } catch (error) {
      console.error(`   ❌ エラー:`, (error as Error).message);
    }

    console.log('');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ データ収集完了');
  console.log('\n📝 確認項目:');
  console.log('  [ ] 梅田・なんば駅が一律「低」にならない（都市部）');
  console.log('  [ ] 天川村が相対的に暗い判定（山村部）');
  console.log('  [ ] Black Marble成功時とGIBS値が適切に分離している');
  console.log('  [ ] データソース（direct/gap-filled/gibs/fallback）が正確');
}

collectData().catch(console.error);
