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
        self._enum_values: dict[tuple[Path, str], int] = {}
        self.initializers = {}

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

    def enum_value(self, name: str, file: Path | None = None) -> int:
        for file in [file] if file is not None else self.files:
            key = (file, name)
            if key in self._enum_values:
                return self._enum_values[key]
            matches = [obj for obj in self._dump(file, name)
                       if obj.get('kind') == 'EnumConstantDecl' and obj.get('name') == name]
            if len(matches) > 1:
                raise Unsupported(f'ambiguous scoped C enumerator {name} in {file.name}')
            for obj in matches:
                found = _find_enum(obj, name)
                if found is not None:
                    self._enum_values[key] = found
                    return found
                if obj.get('kind') == 'EnumConstantDecl' and obj.get('name') == name:
                    # A filtered implicit enumerator omits its preceding
                    # siblings. Ask clang to evaluate a new constant expression
                    # in the original translation unit instead of guessing it.
                    cmd = ['clang', '-fsyntax-only', f'-I{self.include}', *CFLAGS,
                           '-x', 'c', '-Xclang', '-ast-dump=json', '-Xclang',
                           '-ast-dump-filter=verification_enum_value', '-']
                    source = f'#include "{file}"\nenum {{ verification_enum_value = {name} }};\n'
                    output = subprocess.run(cmd, input=source, capture_output=True,
                                            text=True, check=True).stdout
                    for decl in _objects(output):
                        value = _find_enum(decl, 'verification_enum_value')
                        if value is not None:
                            self._enum_values[key] = value
                            return value
        raise Unsupported(f'no enumerator {name}')

    def constant_array(self, name: str, file: Path) -> dict:
        """Only immutable array definitions; initializers are interpreted by CExec."""
        matches = [obj for obj in self._dump(file, name)
                   if obj.get('kind') == 'VarDecl' and obj.get('name') == name]
        if len(matches) > 1:
            raise Unsupported(f'ambiguous scoped C array {name} in {file.name}')
        for obj in matches:
            qual = obj['type']['qualType']
            if 'const ' in qual and qual.endswith(']') and obj.get('init'):
                return obj
        raise Unsupported(f'no constant C array {name} in {file.name}')

    def initialized_array(self, name: str, file: Path) -> dict:
        """A spec may explicitly assume an initialized table has not changed."""
        matches = [obj for obj in self._dump(file, name)
                   if obj.get('kind') == 'VarDecl' and obj.get('name') == name and obj.get('init')]
        if len(matches) != 1 or not matches[0]['type']['qualType'].endswith(']'):
            raise Unsupported(f'no unique initialized C array {name} in {file.name}')
        self.sources.setdefault(str(file), file.read_bytes())
        return matches[0]

    def record_fields(self, qual: str, file: Path) -> list[str]:
        if not qual.startswith('struct '):
            raise Unsupported(f'C aggregate {qual}')
        name = qual.removeprefix('struct ')
        matches = [obj for obj in self._dump(file, name)
                   if obj.get('kind') == 'RecordDecl' and obj.get('name') == name
                   and obj.get('completeDefinition')]
        if len(matches) != 1:
            raise Unsupported(f'no unique C record definition {qual}')
        fields = [node['name'] for node in matches[0]['inner'] if node['kind'] == 'FieldDecl']
        return fields

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
