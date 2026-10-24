"""C front end: clang's own typed JSON AST of the pinned NetHack sources.

Clang resolves macros, #if blocks, typedefs, and every implicit integer
conversion, so the executor never re-implements C parsing or the usual
arithmetic conversions. Flags mirror the recorder Makefile's CFLAGS.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from core import Unsupported

CFLAGS = ['-DNOTPARMDECL', '-DNO_TIMED_DELAY']


def _objects(text: str):
    decoder = json.JSONDecoder()
    i = 0
    while i < len(text):
        while i < len(text) and text[i].isspace():
            i += 1
        if i >= len(text):
            break
        obj, i = decoder.raw_decode(text, i)
        yield obj


class CFront:
    def __init__(self, recorder: Path, files: list[Path]):
        self.include = recorder / 'include'
        self.files = files
        self._dumps: dict[tuple[Path, str], list] = {}
        self.sources: dict[str, bytes] = {}

    def _dump(self, file: Path, name: str) -> list:
        key = (file, name)
        if key not in self._dumps:
            cmd = ['clang', '-fsyntax-only', f'-I{self.include}', *CFLAGS,
                   '-Xclang', '-ast-dump=json', '-Xclang', f'-ast-dump-filter={name}', str(file)]
            out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
            self._dumps[key] = list(_objects(out))
        return self._dumps[key]

    def function(self, name: str) -> tuple[dict, Path]:
        """The definition of `name` from the first listed file that defines it."""
        for file in self.files:
            for obj in self._dump(file, name):
                if (obj.get('kind') == 'FunctionDecl' and obj.get('name') == name
                        and any(c.get('kind') == 'CompoundStmt' for c in obj.get('inner', []))):
                    self.sources.setdefault(str(file), file.read_bytes())
                    return obj, file
        raise Unsupported(f'no C definition of {name} in {[str(f) for f in self.files]}')

    def enum_value(self, name: str) -> int:
        for file in self.files:
            for obj in self._dump(file, name):
                found = _find_enum(obj, name)
                if found is not None:
                    return found
        raise Unsupported(f'no enumerator {name}')

    def line(self, file: Path, node: dict) -> str:
        loc = node.get('range', {}).get('begin', node.get('loc', {}))
        loc = loc.get('expansionLoc', loc)
        offset = loc.get('offset')
        if offset is None:
            return file.name
        return f'{file.name}:{self.sources[str(file)][:offset].count(b"\n") + 1}'


def _find_enum(node: dict, name: str):
    if node.get('kind') == 'EnumConstantDecl' and node.get('name') == name:
        for c in node.get('inner', []):
            if c.get('kind') == 'ConstantExpr' and 'value' in c:
                return int(c['value'])
        return None
    for c in node.get('inner', []):
        found = _find_enum(c, name)
        if found is not None:
            return found
    return None
