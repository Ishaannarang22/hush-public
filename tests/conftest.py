import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
for path in (HERE, os.path.dirname(HERE)):
    if path not in sys.path:
        sys.path.insert(0, path)
