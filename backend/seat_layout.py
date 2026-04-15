"""
鳳山高中圖書館 K書中心 — 完整座位配置
新館 (New Building): Seats 1-140
舊館 (Old Building): Seats 141-314
"""

SEAT_LAYOUT = []


def _add(numbers, zone, building, seat_type="normal"):
    for num in numbers:
        SEAT_LAYOUT.append({
            "seat_number": num,
            "label": str(num).zfill(3),
            "zone": zone,
            "building": building,
            "seat_type": seat_type,
        })


# ═══════════════════════════════════
#  新館 (New Building) — Seats 1-140
# ═══════════════════════════════════

# 新1(315): 座位 1~16
_add(range(1, 17), "新1(315)", "新館")

# 新2(308): 座位 17~28
_add(range(17, 29), "新2(308)", "新館")

# 新3(311): 座位 29~44
# 特殊座位: 34,35=工讀生, 36,44=柱子
_normal_311 = [n for n in range(29, 45) if n not in (34, 35, 36, 44)]
_add(_normal_311, "新3(311)", "新館")
_add([34, 35], "新3(311)", "新館", "staff")
_add([36, 44], "新3(311)", "新館", "pillar")

# 新4(314): 座位 45~56
_add(range(45, 57), "新4(314)", "新館")

# 中間區: 座位 57~84
# 特殊座位: 64=柱子, 72=工讀生, 77=柱子, 83=工讀生
_normal_mid = [n for n in range(57, 85) if n not in (64, 72, 77, 83)]
_add(_normal_mid, "中間區", "新館")
_add([64, 77], "中間區", "新館", "pillar")
_add([72, 83], "中間區", "新館", "staff")

# 新5(309): 座位 85~98
_add(range(85, 99), "新5(309)", "新館")

# 新6(306): 座位 99~112
_add(range(99, 113), "新6(306)", "新館")

# 新7(301): 座位 113~126
_add(range(113, 127), "新7(301)", "新館")

# 新8(317): 座位 127~140
_add(range(127, 141), "新8(317)", "新館")


# ═══════════════════════════════════
#  舊館 (Old Building) — Seats 141-314
# ═══════════════════════════════════

# 工讀生座位: 141~149
_add(range(141, 150), "工讀生區", "舊館", "staff")

# 主區域: 150~314
_add(range(150, 315), "主區域", "舊館")

# Sort by seat number
SEAT_LAYOUT.sort(key=lambda s: s["seat_number"])
