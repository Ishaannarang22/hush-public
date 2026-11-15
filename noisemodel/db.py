"""Decibel helpers. Levels in dB, energies as 10^(L/10). A level of None means no sound."""
import math


def energy(level):
    """Energy of a level; None or -inf gives 0."""
    if level is None or level == -math.inf:
        return 0.0
    return 10.0 ** (level / 10.0)


def level(e):
    """Level of an energy; zero or negative energy gives None (no log of zero, V1 5b)."""
    if e is None or e <= 0.0:
        return None
    return 10.0 * math.log10(e)


def energy_sum(levels):
    """Energy sum of levels; None if there is no energy."""
    return level(sum(energy(x) for x in levels))


def energy_mean(levels):
    """Energy mean of levels; None if the list is empty or silent."""
    levels = list(levels)
    if not levels:
        return None
    return level(sum(energy(x) for x in levels) / len(levels))
