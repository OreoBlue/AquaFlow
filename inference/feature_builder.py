"""Example time-window features. Team ML MUST train on identical extraction before live deployment.

This module uses only Python's standard library for offline verification.
Provisional features/window parameters are not established research results.
"""
from __future__ import annotations
from math import isfinite
from statistics import mean, pstdev

LABELS = ('NORMAL', 'ALIRAN_MASUK_TINGGI', 'TERSUMBAT')
SENSORS = ('inletLpm', 'outletLpm', 'upstreamCm', 'downstreamCm')
FEATURE_NAMES = (
    'inlet_mean', 'outlet_mean', 'upstream_mean', 'downstream_mean',
    'gap_mean', 'flow_ratio_mean', 'inlet_slope', 'outlet_slope',
    'upstream_slope', 'downstream_slope',
)


def valid_reading(row: dict) -> bool:
    """Reject invalid readings and ensure explicit booleans (bool is numeric in Python)."""
    if not isinstance(row, dict):
        return False
    ts = row.get('timestamp')
    if type(ts) not in (int, float) or not isfinite(ts) or ts <= 0:
        return False
    if row.get('sensorValid', True) is False:
        return False
    if type(row.get('pumpOn')) is not bool or type(row.get('floatSafe')) is not bool:
        return False
    for key in SENSORS:
        val = row.get(key)
        if type(val) not in (int, float) or not isfinite(val):
            return False
        if not 0 <= val <= (15 if 'Cm' in key else 30):
            return False
    return True


def make_features(rows: list[dict], window_samples: int = 10) -> dict[str, float]:
    """Produce one time-ordered feature vector; reject gaps, mixed sessions and poor-quality windows."""
    if window_samples < 3:
        raise ValueError('window_samples minimal 3')
    if len(rows) < window_samples:
        raise ValueError('Jumlah baris belum memenuhi jendela inferensi')
    rows = sorted(rows, key=lambda r: r['timestamp'])[-window_samples:]
    if not all(valid_reading(r) for r in rows):
        raise ValueError('Sensor invalid/di luar rentang: inferensi tidak dilakukan')
    if not all(r['pumpOn'] and r['floatSafe'] for r in rows):
        raise ValueError('Pengaman lokal aktif atau pompa berhenti: ML ditunda')
    sessions = {r.get('sessionId') for r in rows}
    if len(sessions) != 1:
        raise ValueError('Jendela memuat dua sessionId yang berbeda')
    timestamps = [r['timestamp'] for r in rows]
    gaps = [b-a for a, b in zip(timestamps, timestamps[1:])]
    if any(g <= 0 or g > 2500 for g in gaps):
        raise ValueError('Timestamp ganda atau jarak sampel terlalu besar (target 1 Hz)')
    elapsed_sec = (timestamps[-1] - timestamps[0]) / 1000
    if elapsed_sec <= 0:
        raise ValueError('Durasi jendela tidak valid')
    series = {key: [r[key] for r in rows] for key in SENSORS}
    ratios = [r['outletLpm'] / r['inletLpm'] if r['inletLpm'] > 0.05 else 0.0 for r in rows]
    feats = {
        'inlet_mean': mean(series['inletLpm']),
        'outlet_mean': mean(series['outletLpm']),
        'upstream_mean': mean(series['upstreamCm']),
        'downstream_mean': mean(series['downstreamCm']),
        'gap_mean': mean([u-d for u, d in zip(series['upstreamCm'], series['downstreamCm'])]),
        'flow_ratio_mean': mean(ratios),
    }
    for key, short in [('inletLpm', 'inlet'), ('outletLpm', 'outlet'), ('upstreamCm', 'upstream'), ('downstreamCm', 'downstream')]:
        feats[f'{short}_slope'] = (series[key][-1] - series[key][0]) / elapsed_sec
    return feats


def vector_for_model(features: dict[str, float], contract: dict) -> list[float]:
    """Honor the feature order declared by team ML in the model contract."""
    names = contract.get('feature_names')
    if not isinstance(names, list) or not names or len(set(names)) != len(names):
        raise ValueError('Kontrak fitur kosong atau tidak valid')
    missing = set(names).difference(FEATURE_NAMES)
    if missing:
        raise ValueError(f'Nama fitur belum didukung: {sorted(missing)}. Perbarui ekstraksi bersama tim ML.')
    return [features[name] for name in names]
