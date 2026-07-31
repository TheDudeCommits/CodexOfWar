#!/usr/bin/env python3
"""Inspect post-decimation triangle area tails in the Round005 authored blend."""

from __future__ import annotations

import json

import bpy


NAMES = (
    "P10R5_LOD1_MECH",
    "P10R5_LOD2_MECH",
    "P10R5_LOD2_CLOTHING",
)
THRESHOLDS = (
    1e-18,
    1e-17,
    1e-16,
    1e-15,
    1e-14,
    1e-13,
    1e-12,
    5e-12,
    1e-11,
    1.25e-11,
    1.5e-11,
    2e-11,
    5e-11,
    1e-10,
)


def main() -> None:
    report = {}
    for name in NAMES:
        obj = bpy.data.objects[name]
        mesh = obj.data
        mesh.calc_loop_triangles()
        values = []
        for triangle in mesh.loop_triangles:
            first, second, third = (
                mesh.vertices[index].co for index in triangle.vertices
            )
            values.append((second - first).cross(third - first).length_squared)
        values.sort()
        report[name] = {
            "triangles": len(values),
            "counts_at_or_below_cross_length_squared": {
                f"{threshold:.0e}": sum(value <= threshold for value in values)
                for threshold in THRESHOLDS
            },
            "smallest_80_cross_length_squared": values[:80],
        }
    print("P10_TINY_FACE_REPORT=" + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
