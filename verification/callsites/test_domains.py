"""Require an invalid-argument JS mutant to kill every classified site.

    uv run ../callsites/test_domains.py healthy.json mutants.json

Generate mutants with extract.mjs --mutate-domains. Both inputs describe
the emitted program; no game files are changed by this gate.
"""
from __future__ import annotations

from collections import Counter
import json
import sys

from check import Bounds, classify


def indexed(sites):
    occurrences = Counter()
    for site in sites:
        location = (site['file'], site['line'], site['draw'])
        occurrences[location] += 1
        yield (*location, occurrences[location]), site


def main():
    with open(sys.argv[1]) as source:
        healthy = json.load(source)
    with open(sys.argv[2]) as source:
        changed = json.load(source)
    mutants = dict(indexed(changed['sites']))
    normal_bounds = Bounds(healthy['summaries'], healthy['locals'])
    mutant_bounds = Bounds(changed['summaries'], changed['locals'])
    killed, failures = Counter(), []
    for key, site in indexed(healthy['sites']):
        part = 'upper' if site['draw'] == 'rnz' else 'lower'
        kind, _ = classify(site, part, normal_bounds)
        if kind == 'unproved':
            continue
        if key not in mutants:
            failures.append(f'{key}: mutant site missing')
            continue
        result, reason = classify(mutants[key], part, mutant_bounds)
        if result != 'unproved' or reason in ('solver gave up', 'no feasible modeled input (not counted as a proof)'):
            failures.append(f'{key}: mutant {result}: {reason}')
        else:
            killed[kind] += 1
    if not killed and not failures:
        failures.append('No classified sites: the mutant gate had nothing to challenge')
    for failure in failures:
        print(f'FAIL {failure}')
    print(f'{sum(killed.values())} mutants killed: {dict(killed)}; {len(failures)} failures')
    return bool(failures)


if __name__ == '__main__':
    sys.exit(main())
