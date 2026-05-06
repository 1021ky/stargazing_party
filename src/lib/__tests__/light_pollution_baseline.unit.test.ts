import {
  formatLightPollutionDataLabel,
  resolveGibsLightPollutionDate,
  resolveLightPollutionBaseDate,
  resolveLightPollutionBaseMonth,
  resolveLightPollutionBaseYear,
} from "../light_pollution_baseline";

describe("resolveLightPollutionBaseYear", () => {
  it("明示的な年が渡された場合はその年を返す", () => {
    expect(resolveLightPollutionBaseYear(2022)).toBe(2022);
  });

  it("環境変数 LIGHT_POLLUTION_BASE_YEAR を使う", () => {
    const orig = process.env.LIGHT_POLLUTION_BASE_YEAR;
    process.env.LIGHT_POLLUTION_BASE_YEAR = "2020";
    try {
      expect(resolveLightPollutionBaseYear()).toBe(2020);
    } finally {
      process.env.LIGHT_POLLUTION_BASE_YEAR = orig;
    }
  });

  it("明示的な年が環境変数より優先される", () => {
    const orig = process.env.LIGHT_POLLUTION_BASE_YEAR;
    process.env.LIGHT_POLLUTION_BASE_YEAR = "2020";
    try {
      expect(resolveLightPollutionBaseYear(2023)).toBe(2023);
    } finally {
      process.env.LIGHT_POLLUTION_BASE_YEAR = orig;
    }
  });
});

describe("resolveLightPollutionBaseMonth", () => {
  afterEach(() => {
    delete process.env.LIGHT_POLLUTION_BASE_MONTH;
  });

  it.each([
    { input: 1, expected: 1 },
    { input: 6, expected: 6 },
    { input: 12, expected: 12 },
  ])(
    "明示的な月 $input が渡された場合はその月を返す",
    ({ input, expected }) => {
      expect(resolveLightPollutionBaseMonth(input)).toBe(expected);
    },
  );

  it.each([{ input: 0 }, { input: 13 }, { input: -1 }, { input: Number.NaN }])(
    "範囲外・不正な月 $input の場合はデフォルト 1 を返す",
    ({ input }) => {
      expect(resolveLightPollutionBaseMonth(input)).toBe(1);
    },
  );

  it("引数なしの場合はデフォルト 1 を返す", () => {
    expect(resolveLightPollutionBaseMonth()).toBe(1);
  });

  it("環境変数 LIGHT_POLLUTION_BASE_MONTH を使う", () => {
    process.env.LIGHT_POLLUTION_BASE_MONTH = "3";
    expect(resolveLightPollutionBaseMonth()).toBe(3);
  });

  it("明示的な月が環境変数より優先される", () => {
    process.env.LIGHT_POLLUTION_BASE_MONTH = "3";
    expect(resolveLightPollutionBaseMonth(8)).toBe(8);
  });

  it("環境変数が不正な値の場合はデフォルト 1 を返す", () => {
    process.env.LIGHT_POLLUTION_BASE_MONTH = "invalid";
    expect(resolveLightPollutionBaseMonth()).toBe(1);
  });
});

describe("resolveLightPollutionBaseDate", () => {
  afterEach(() => {
    delete process.env.LIGHT_POLLUTION_BASE_YEAR;
    delete process.env.LIGHT_POLLUTION_BASE_MONTH;
    delete process.env.LIGHT_POLLUTION_BASE_DATE;
  });

  it.each([
    { year: 2024, month: undefined, expected: "2024-01-01" },
    { year: 2024, month: 1, expected: "2024-01-01" },
    { year: 2024, month: 3, expected: "2024-03-01" },
    { year: 2024, month: 12, expected: "2024-12-01" },
  ])("year=$year month=$month → $expected", ({ year, month, expected }) => {
    expect(resolveLightPollutionBaseDate(year, month)).toBe(expected);
  });

  it("月が省略された場合はデフォルト 01 を使う", () => {
    expect(resolveLightPollutionBaseDate(2023)).toBe("2023-01-01");
  });

  it("環境変数 LIGHT_POLLUTION_BASE_DATE が設定されている場合はそれを優先する", () => {
    process.env.LIGHT_POLLUTION_BASE_DATE = "2021-06-01";
    expect(resolveLightPollutionBaseDate(2024, 3)).toBe("2021-06-01");
  });

  it("環境変数 LIGHT_POLLUTION_BASE_MONTH と組み合わせて動作する", () => {
    process.env.LIGHT_POLLUTION_BASE_MONTH = "7";
    expect(resolveLightPollutionBaseDate(2024)).toBe("2024-07-01");
  });
});

describe("resolveGibsLightPollutionDate", () => {
  afterEach(() => {
    delete process.env.GIBS_WMS_TIME;
  });

  it.each([
    { input: undefined, expected: "2016-01-01" },
    { input: 2024, expected: "2016-01-01" },
    { input: 2016, expected: "2016-01-01" },
    { input: 2014, expected: "2012-01-01" },
    { input: 2011, expected: "2012-01-01" },
  ])("year=$input → $expected", ({ input, expected }) => {
    expect(resolveGibsLightPollutionDate(input)).toBe(expected);
  });

  it("環境変数 GIBS_WMS_TIME が設定されている場合はそれを優先する", () => {
    process.env.GIBS_WMS_TIME = "2019-09-01";
    expect(resolveGibsLightPollutionDate(2024)).toBe("2019-09-01");
  });
});

describe("formatLightPollutionDataLabel", () => {
  it.each([
    { date: "2024-01-01", expected: "2024年データ" },
    { date: "2024-03-01", expected: "2024年3月データ" },
    { date: "2024-12-01", expected: "2024年12月データ" },
    { date: "2024-03-15", expected: "2024年3月15日データ" },
    { date: "invalid", expected: "データ時点: 不明" },
  ])("$date → $expected", ({ date, expected }) => {
    expect(formatLightPollutionDataLabel(date)).toBe(expected);
  });
});
