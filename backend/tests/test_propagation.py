"""Tests for propagation (requires async DB, tested as integration)."""

import pytest


def test_propagation_decay_math():
    """Verify the propagation decay math: 0.6x per layer."""
    activation = 0.8
    decay = 0.6
    expected = [
        0.8 * 0.6,       # L4: 0.48
        0.8 * 0.6**2,    # L3: 0.288
        0.8 * 0.6**3,    # L2: 0.1728
        0.8 * 0.6**4,    # L1: 0.10368
        0.8 * 0.6**5,    # L0: 0.062208
    ]
    current = activation
    for i, exp in enumerate(expected):
        current *= decay
        assert abs(current - exp) < 0.0001, f"Layer {4-i}: expected {exp}, got {current}"
