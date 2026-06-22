// 台灣羽球推廣協會 羽球程度分級制度 (1-18)

export interface LevelTier {
  name: string
  min: number
  max: number
  note: string // 球齡 / 對應零打團程度
  avatarBg: string // full Tailwind classes (literal, so JIT keeps them)
  chip: string
}

export const TIERS: LevelTier[] = [
  { name: '新手階', min: 1, max: 3, note: '初學,熟悉規則與禮儀', avatarBg: 'bg-rose-300', chip: 'bg-rose-100 text-rose-600' },
  { name: '初階', min: 4, max: 5, note: '球齡 1~3 年,一般零打團之初階', avatarBg: 'bg-emerald-300', chip: 'bg-emerald-100 text-emerald-700' },
  { name: '初中階', min: 6, max: 7, note: '球齡 3~5 年,一般零打團之中下', avatarBg: 'bg-teal-300', chip: 'bg-teal-100 text-teal-700' },
  { name: '中階', min: 8, max: 9, note: '球齡 5~10 年,一般零打團之中階', avatarBg: 'bg-amber-300', chip: 'bg-amber-100 text-amber-700' },
  { name: '中進階', min: 10, max: 12, note: '球齡 10 年以上,一般零打團之中上', avatarBg: 'bg-sky-300', chip: 'bg-sky-100 text-sky-700' },
  { name: '高階', min: 13, max: 15, note: '校隊前段、體保、社會甲組等', avatarBg: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700' },
  { name: '職業級', min: 16, max: 18, note: '甲組、國家代表選手', avatarBg: 'bg-violet-400', chip: 'bg-violet-100 text-violet-700' },
]

export function tierOf(level: number): LevelTier | null {
  if (!level) return null
  return TIERS.find((t) => level >= t.min && level <= t.max) ?? null
}

// per-level skill description (從分級表轉錄)
export const LEVEL_DESC: Record<number, string> = {
  1: '剛接觸羽球,學會比賽規則,並懂得比賽禮儀',
  2: '在中場距離中高球來回 10 拍,發球有一半以上成功率',
  3: '定點來回一半可打到 2/3 場後,發球有九成以上成功率',
  4: '清楚正確握拍,長球男生定點可到後場、女生到中後場,會基本平推,正反拍均有一定表現',
  5: '清楚正確握拍,略懂基本步法,基本球路在非受迫時有一定表現',
  6: '略懂基本步法與輪轉(尚不熟練),開始會殺球及切球,非受迫時移動長球可至中後場',
  7: '殺、切、長球不論定點或移動,成功率與穩定性七成以上,已有基本防守但無變化',
  8: '有基本戰略及打點,熟悉基本輪轉,切殺長吊七成以上準確,防守有些微變化',
  9: '切殺長吊有三種球路九成以上準確與質量,發力有強度,防守有一定變化與穩定性',
  10: '輪轉概念熟悉且能活用,策略性戰略及打點皆能有效得分',
  11: '切殺長吊皆具準確性,發力速度策略兼具,輕鬆完成反拍各種球路,防守具威脅性',
  12: '高速移位與靈敏走位步法,殺切吊具高速侵略性,常有一擊必殺球路',
  13: '各種球路穩定純熟,防守無死角、球速快質量高、戰略組織與爆發力俱佳',
  14: '各種球路穩定純熟,防守無死角、球速快質量高(校隊/體保/社會甲組水準)',
  15: '各種球路穩定純熟,頂尖業餘水準',
  16: '各種球路、戰術、步法爐火純青,發展出個人獨特球路風格',
  17: '職業水準,甲組/國家代表選手',
  18: '頂尖職業水準',
}
