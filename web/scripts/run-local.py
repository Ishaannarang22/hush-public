"""Launch the local preview with credentials held in process memory only."""
import getpass
import json
import os
import shutil
credentials = json.loads(getpass.getpass('Matterport credentials JSON (hidden): '))
allowed = {'MATTERPORT_API_KEY', 'MATTERPORT_API_TOKEN', 'MATTERPORT_SDK_KEY'}
if set(credentials) - allowed:
    raise SystemExit('Unexpected credential names')
node = shutil.which('node')
if not node:
    raise SystemExit('Node.js 24 is required')
os.execve(node, [node, 'node_modules/vite/bin/vite.js', '--host', 'localhost', '--port', '5173'], {**os.environ, **credentials})
