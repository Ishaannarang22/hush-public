"""Loads assumptions.yaml. Every number the model uses is read through Assumptions.value().

Each leaf entry is {value, unit, source, status}. Reads are recorded in `used`, so a run can list
every value it relied on. Overrides replace a value by dotted key and are marked status 'override'.
"""
import copy
import os

import yaml

DEFAULT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assumptions.yaml")

_CACHE = {}


def _read(path):
    if path not in _CACHE:
        with open(path) as fh:
            _CACHE[path] = yaml.safe_load(fh)
    return _CACHE[path]


def _is_entry(node):
    return isinstance(node, dict) and "value" in node and "status" in node


class Assumptions(object):
    def __init__(self, tree):
        self._tree = tree
        self.used = {}

    @classmethod
    def load(cls, path=None, overrides=None):
        tree = copy.deepcopy(_read(path or DEFAULT_PATH))
        a = cls(tree)
        for key, val in (overrides or {}).items():
            a.set(key, val)
        return a

    def entries(self):
        """Yield (dotted key, entry) for every leaf entry."""
        stack = [("", self._tree)]
        while stack:
            prefix, node = stack.pop()
            for k, v in node.items():
                key = prefix + str(k)
                if _is_entry(v):
                    yield key, v
                elif isinstance(v, dict):
                    stack.append((key + ".", v))

    def entry(self, key):
        node = self._tree
        for part in key.split("."):
            if not isinstance(node, dict) or part not in node:
                return None
            node = node[part]
        return node if _is_entry(node) else None

    def has(self, key):
        return self.entry(key) is not None

    def value(self, key):
        e = self.entry(key)
        if e is None:
            raise KeyError("assumptions.yaml has no entry %r" % key)
        self.used[key] = {"value": e["value"], "status": e["status"], "source": e.get("source")}
        return e["value"]

    def status(self, key):
        e = self.entry(key)
        return None if e is None else e["status"]

    def set(self, key, val):
        e = self.entry(key)
        if e is None:
            raise KeyError("assumptions.yaml has no entry %r" % key)
        e["source"] = "override (was %r, %s)" % (e["value"], e["status"])
        e["value"] = val
        e["status"] = "override"
