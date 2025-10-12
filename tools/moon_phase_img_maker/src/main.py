import math
import os
from PIL import Image, ImageDraw
from functools import lru_cache


try:
    import astronomy as astro  # type: ignore[import]
except Exception as e:
    raise RuntimeError(
        "astronomy package is required for this script.\n"
        "Please install it: pip install astronomy-engine"
    ) from e

"""calender pickerで使う月齢のアイコン画像を生成する

astronomy-engineを使い、実アプリと同じ月齢ロジックに合わせる。
新月を moon_00.jpg とし、以降 moon_{月齢}.jpg を出力する。
"""

# 設定
SIZE = 128  # 画像サイズ(縦横同じ)
MARGIN = 8  # 月ディスクの余白
BG = (255, 255, 255)  # 背景色（JPEGなので不透明)
MOON = (255, 214, 0)  # 月の色
SHADOW = (0, 0, 0)  # 影（黒)
DAYS = 30  # 出力する月齢数（0..29)
OUTDIR = "./out"  # 出力先

# 基準となる新月（固定）
_REFERENCE_START = astro.Time.Make(2000, 1, 1, 0, 0, 0)

# ------------- 描画ユーティリティ ----------------


def circle_overlap_area_equal_r(d: float, r: float) -> float:
    """半径が同じ2円（半径r、中心間距離d）の重なり面積。"""
    if d <= 0:
        return math.pi * r * r
    if d >= 2 * r:
        return 0.0
    return 2 * r * r * math.acos(d / (2 * r)) - 0.5 * d * math.sqrt(
        4 * r * r - d * d
    )


def d_from_lit_fraction(f: float, r: float) -> float:
    """
    可視（照らされている）面積の比 f に対して、減算用の黒円のオフセット距離 d を
    2円の面積公式から数値的に求める。f=0 -> d=0, f=1 -> d=2r
    """
    if f <= 0.0:
        return 0.0
    eps = max(1e-3, r * 1e-4)
    if f >= 1.0:
        return 2 * r - eps

    area_circle = math.pi * r * r

    def lit_from_d(dval: float) -> float:
        overlap = circle_overlap_area_equal_r(dval, r)
        return 1.0 - (overlap / area_circle)

    # Use hi = 2*r - eps to ensure overlap instead of tangent at full darkness.
    lo, hi = 0.0, 2 * r - eps
    for _ in range(40):
        mid = (lo + hi) / 2
        if lit_from_d(mid) < f:
            lo = mid
        else:
            hi = mid
    # final clip to ensure we never return a value >= 2*r
    d = (lo + hi) / 2
    return min(d, 2 * r - eps)


def render_moon_icon(
    *,
    fraction: float,
    waxing: bool,
    phase_deg: float,
    size=SIZE,
    margin=MARGIN,
) -> Image.Image:
    """指定照度の月を4層構成で描画する。"""

    cx = cy = size // 2
    r = (size - 2 * margin) // 2
    bbox = (cx - r, cy - r, cx + r, cy + r)

    moon_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(moon_mask).ellipse(bbox, fill=255)

    result = Image.new("RGBA", (size, size), BG + (255,))

    # --- layer 1: 基底であり、新月となる真っ黒な円のレイヤー ---
    base_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(base_layer).ellipse(bbox, fill=SHADOW + (255,))
    result = Image.alpha_composite(result, base_layer)

    # --- layer 2: 照らされている部分 ---
    lit_mask = Image.new("L", (size, size), 0)
    lit_pixels = lit_mask.load()
    moon_pixels = moon_mask.load()

    sun_angle = math.radians(phase_deg % 360.0)
    sun_dir = (
        math.sin(sun_angle),
        0.0,
        -math.cos(sun_angle),
    )

    for py in range(size):
        dy = (py - cy) / r
        for px in range(size):
            if moon_pixels[px, py] == 0:
                continue
            dx = (px - cx) / r
            nz_sq = 1.0 - dx * dx - dy * dy
            if nz_sq <= 0.0:
                continue
            dz = math.sqrt(nz_sq)
            dot = dx * sun_dir[0] + dy * sun_dir[1] + dz * sun_dir[2]
            if dot > 0.0:
                lit_pixels[px, py] = 255

    lit_layer = Image.new("RGBA", (size, size), MOON + (0,))
    lit_layer.putalpha(lit_mask)
    result = Image.alpha_composite(result, lit_layer)

    # --- layer 4: 縁取り ---
    outline_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(outline_layer).ellipse(bbox, outline=(0, 0, 0), width=1)
    result = Image.alpha_composite(result, outline_layer)

    return result.convert("RGB")


@lru_cache(maxsize=1)  # 常に同じ結果を返すのでキャッシュして高速化
def base_new_moon() -> astro.Time:
    """固定開始時刻から最初の新月を検索して返す（安定出力用）。"""
    return astro.SearchMoonPhase(
        0.0,
        _REFERENCE_START,
        limitDays=40.0,
    )  # type: ignore


def fraction_and_waxing_at_age(
    age_days: int, base: astro.Time
) -> tuple[float, bool, float]:
    """
    base から age_days 日後の月の照度と満ち方向を返す。
    """
    ill = astro.Illumination(astro.Body.Moon, base.AddDays(float(age_days)))
    fraction = ill.phase_fraction
    phase_deg = astro.MoonPhase(ill.time)
    waxing = phase_deg < 180.0
    return fraction, waxing, phase_deg


def save_icon(age: int, outdir: str, size: int):
    """指定された月齢の月アイコンを生成し、指定された出力先に保存する。

    :param age: 月齢（0..29）
    :param outdir: 出力先ディレクトリ
    :param size: 画像サイズ
    :param t0: 基準時刻
    """
    fraction, waxing, phase_deg = fraction_and_waxing_at_age(
        age, base_new_moon()
    )
    img = render_moon_icon(
        fraction=fraction,
        waxing=waxing,
        phase_deg=phase_deg,
        size=size,
    )
    path = os.path.join(outdir, f"moon_{age:02d}.jpg")
    img.save(
        path,
        format="JPEG",
        quality=92,
        optimize=True,
        progressive=True,
    )
    print(f"saved: {path}")


def save_all_icons(days=DAYS, outdir=OUTDIR, size=SIZE):
    """全月齢の月アイコンを生成し、指定された出力先に保存する。"""
    os.makedirs(outdir, exist_ok=True)

    # 全月齢のアイコンを生成
    for age in range(days):
        save_icon(age=age, outdir=outdir, size=size)


if __name__ == "__main__":
    save_all_icons()
