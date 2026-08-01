"""Statcast constant-acceleration pitch trajectory.

Each pitch is a 9-parameter model (release position, velocity, acceleration).
Paths are sampled from release to the front of home plate for 3D rendering
and tunnel analysis.
"""

from __future__ import annotations

from typing import Any

# Front of home plate in Statcast coordinates (feet). Through 2025 MLB used
# front-of-plate for plate_x/plate_z; 2026+ may shift to middle-of-plate for ABS.
Y_PLATE_FT = 1.417
TUNNEL_T = 0.150  # decision window seconds after release


def _pos(
    x0: float,
    y0: float,
    z0: float,
    vx0: float,
    vy0: float,
    vz0: float,
    ax: float,
    ay: float,
    az: float,
    t: float,
) -> tuple[float, float, float]:
    return (
        x0 + vx0 * t + 0.5 * ax * t * t,
        y0 + vy0 * t + 0.5 * ay * t * t,
        z0 + vz0 * t + 0.5 * az * t * t,
    )


def plate_time(
    release_pos_x: float,
    release_pos_y: float,
    release_pos_z: float,
    vx0: float,
    vy0: float,
    vz0: float,
    ax: float,
    ay: float,
    az: float,
    y_plate: float = Y_PLATE_FT,
) -> float:
    """Solve y(t) = y_plate for the smallest t > 0 (quadratic in t)."""
    # 0.5*ay*t^2 + vy0*t + (y0 - y_plate) = 0
    a = 0.5 * ay
    b = vy0
    c = release_pos_y - y_plate
    if abs(a) < 1e-12:
        if abs(b) < 1e-12:
            raise ValueError("no positive plate time")
        t = -c / b
        if t <= 0:
            raise ValueError("no positive plate time")
        return t
    disc = b * b - 4 * a * c
    if disc < 0:
        raise ValueError("no real plate time")
    sqrt_d = disc**0.5
    candidates = [(-b + sqrt_d) / (2 * a), (-b - sqrt_d) / (2 * a)]
    positive = [t for t in candidates if t > 1e-6]
    if not positive:
        raise ValueError("no positive plate time")
    return min(positive)


def tunnel_point(
    release_pos_x: float,
    release_pos_y: float,
    release_pos_z: float,
    vx0: float,
    vy0: float,
    vz0: float,
    ax: float,
    ay: float,
    az: float,
    t: float = TUNNEL_T,
) -> dict[str, float]:
    """Ball position at the decision / tunnel freeze time."""
    x, y, z = _pos(
        release_pos_x,
        release_pos_y,
        release_pos_z,
        vx0,
        vy0,
        vz0,
        ax,
        ay,
        az,
        t,
    )
    return {"t": t, "x": x, "y": y, "z": z}


def sample_trajectory(
    release_pos_x: float,
    release_pos_y: float,
    release_pos_z: float,
    vx0: float,
    vy0: float,
    vz0: float,
    ax: float,
    ay: float,
    az: float,
    n: int = 80,
    y_plate: float = Y_PLATE_FT,
    plate_x: float | None = None,
    plate_z: float | None = None,
) -> dict[str, Any]:
    """Sample a full flight path from release to plate."""
    if n < 2:
        raise ValueError("n must be >= 2")
    t_plate = plate_time(
        release_pos_x,
        release_pos_y,
        release_pos_z,
        vx0,
        vy0,
        vz0,
        ax,
        ay,
        az,
        y_plate=y_plate,
    )
    samples: list[dict[str, float]] = []
    for i in range(n):
        t = t_plate * i / (n - 1)
        x, y, z = _pos(
            release_pos_x,
            release_pos_y,
            release_pos_z,
            vx0,
            vy0,
            vz0,
            ax,
            ay,
            az,
            t,
        )
        samples.append({"t": round(t, 5), "x": x, "y": y, "z": z})

    # Blend endpoint toward measured plate_x/z (Statcast plate measurement is
    # independent of the 9-param model and is the truth at the plate plane).
    if plate_x is not None and plate_z is not None:
        last = samples[-1]
        dx = plate_x - last["x"]
        dz = plate_z - last["z"]
        for i, sample in enumerate(samples):
            w = (i / (n - 1)) ** 2
            sample["x"] += dx * w
            sample["z"] += dz * w

    tunnel = tunnel_point(
        release_pos_x,
        release_pos_y,
        release_pos_z,
        vx0,
        vy0,
        vz0,
        ax,
        ay,
        az,
        t=TUNNEL_T,
    )
    # Apply the same plate-blend weight at tunnel time for visual consistency.
    if plate_x is not None and plate_z is not None and t_plate > 0:
        w = min(1.0, (TUNNEL_T / t_plate) ** 2)
        raw_end_x, _, raw_end_z = _pos(
            release_pos_x,
            release_pos_y,
            release_pos_z,
            vx0,
            vy0,
            vz0,
            ax,
            ay,
            az,
            t_plate,
        )
        tunnel["x"] += (plate_x - raw_end_x) * w
        tunnel["z"] += (plate_z - raw_end_z) * w

    return {
        "mode": "kinematic",
        "t_plate": t_plate,
        "samples": samples,
        "tunnel": tunnel,
        "plate": {"x": plate_x, "z": plate_z},
    }


def linear_fallback(
    release_pos_x: float,
    release_pos_y: float,
    release_pos_z: float,
    plate_x: float,
    plate_z: float,
    n: int = 80,
    t_plate: float = 0.425,
) -> dict[str, Any]:
    """Straight-line path when kinematics are missing (degraded mode)."""
    if n < 2:
        raise ValueError("n must be >= 2")
    samples: list[dict[str, float]] = []
    for i in range(n):
        u = i / (n - 1)
        samples.append(
            {
                "t": round(t_plate * u, 5),
                "x": release_pos_x + (plate_x - release_pos_x) * u,
                "y": release_pos_y + (Y_PLATE_FT - release_pos_y) * u,
                "z": release_pos_z + (plate_z - release_pos_z) * u,
            }
        )
    tunnel_idx = min(n - 1, max(0, int(round(TUNNEL_T / t_plate * (n - 1)))))
    mid = samples[tunnel_idx]
    return {
        "mode": "linear_fallback",
        "t_plate": t_plate,
        "samples": samples,
        "tunnel": {"t": TUNNEL_T, "x": mid["x"], "y": mid["y"], "z": mid["z"]},
        "plate": {"x": plate_x, "z": plate_z},
    }


def _coerce_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def flight_from_pitch_fields(fields: dict[str, Any], n: int = 80) -> dict[str, Any]:
    """Build a flight dict from raw pitch column values (TEXT or numeric).

    Prefers full kinematics; falls back to linear release→plate when needed.
    Raises ValueError when neither path is possible.
    """
    keys = (
        "release_pos_x",
        "release_pos_y",
        "release_pos_z",
        "vx0",
        "vy0",
        "vz0",
        "ax",
        "ay",
        "az",
    )
    kin = {k: _coerce_float(fields.get(k)) for k in keys}
    plate_x = _coerce_float(fields.get("plate_x"))
    plate_z = _coerce_float(fields.get("plate_z"))

    if all(v is not None for v in kin.values()):
        return sample_trajectory(
            release_pos_x=kin["release_pos_x"],  # type: ignore[arg-type]
            release_pos_y=kin["release_pos_y"],  # type: ignore[arg-type]
            release_pos_z=kin["release_pos_z"],  # type: ignore[arg-type]
            vx0=kin["vx0"],  # type: ignore[arg-type]
            vy0=kin["vy0"],  # type: ignore[arg-type]
            vz0=kin["vz0"],  # type: ignore[arg-type]
            ax=kin["ax"],  # type: ignore[arg-type]
            ay=kin["ay"],  # type: ignore[arg-type]
            az=kin["az"],  # type: ignore[arg-type]
            n=n,
            plate_x=plate_x,
            plate_z=plate_z,
        )

    release_x = kin["release_pos_x"]
    release_y = kin["release_pos_y"] if kin["release_pos_y"] is not None else 55.0
    release_z = kin["release_pos_z"]
    if (
        release_x is not None
        and release_z is not None
        and plate_x is not None
        and plate_z is not None
    ):
        return linear_fallback(
            release_pos_x=release_x,
            release_pos_y=release_y,
            release_pos_z=release_z,
            plate_x=plate_x,
            plate_z=plate_z,
            n=n,
        )

    raise ValueError("insufficient data to reconstruct pitch flight")
