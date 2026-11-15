RESULT: within tolerance

# Quiet Score cross-check against published sound scores

For @Jandr07 and @Ishaannarang22. Issue #36, plan section 6a (`docs/UNIT_PROFILE_PLAN.md`). Updated
2026-11-14 on the `test/unit-profile-preview` branch.

## Result

**Within tolerance.** At twelve separate Houston addresses, our outdoor traffic level and HowLoud's Soundscore
(the score Apartments.com shows as its Sound Score) agree under every rule of Alejandro's interim tolerance:

| Rule | Limit | Result |
|---|---|---|
| Separate addresses compared | at least 10 | 12 |
| Rank correlation (louder for us, lower score for them) | 0.8 or better | 0.88 |
| Median gap on HowLoud's scale | 2 points or less | 0.43 |
| Largest gap | 5 points or less | 1.96 (freeway-i10-springbranch) |

Nothing was retuned to reach this. The diagnostic line used for the gaps, `HowLoud = 103.6 - 0.54 x DNL`, was
fitted earlier to eight points near two roads. Ten of the twelve addresses below were not part of that fit.

The Quiet Score itself is an indoor score for one unit. HowLoud rates the location outdoors. So this check
compares our outdoor level, in decibels, with their score. It shows our picture of the traffic noise around a
building matches theirs. It does not, and cannot, check the indoor step, which they do not model.

## The twelve addresses

Our level is the model's outdoor free-field road DNL. For the two demo addresses it is the value from their
saved single-road inputs. For the other ten it uses every counted road within 800 m in TxDOT's public 2020
Roadway Inventory (`tools/crosscheck_addresses.py`). Those ten are public map coordinates chosen to span loud
to quiet, not taken from sponsor data. HowLoud scores are from its official API.

| Address | Busiest road in range | Our outdoor DNL (dB) | HowLoud score | Traffic / local / airports | Our level on their scale | Gap |
|---|---|---|---|---|---|---|
| 2219 Greenhouse Rd, Houston TX 77084 | S Greenhouse Rd | 69.9 | 67 Busy | 44 / 0 / 0 | 65.9 | +1.1 |
| 2125 Yale St, Houston TX 77008 | Yale St | 66.8 | 68 Active | 41 / 2 / 0 | 67.5 | +0.5 |
| Point by I-10, Heights | IH0010 | 66.6 | 67 Busy | 43 / 1 / 0 | 67.6 | -0.6 |
| Point by US-59, Upper Kirby | IH0069 | 67.7 | 66 Busy | 44 / 3 / 0 | 67.0 | -1.0 |
| Point near I-10, Spring Branch | IH0010 | 67.7 | 69 Active | 42 / 3 / 0 | 67.0 | +2.0 |
| Point by N Shepherd Dr | SHEPHERD N | 61.1 | 69 Active | 40 / 3 / 0 | 70.6 | -1.6 |
| Point by Westheimer Rd, Montrose | WAUGH DR | 56.0 | 73 Active | 36 / 1 / 0 | 73.4 | -0.4 |
| Residential street, Heights | IH0610 | 68.2 | 67 Busy | 42 / 1 / 0 | 66.8 | +0.2 |
| Residential street, Montrose | IH0069 | 64.0 | 69 Active | 39 / 4 / 0 | 69.0 | -0.0 |
| Residential street, Meyerland | IH0610 | 72.6 | 64 Busy | 50 / 1 / 0 | 64.4 | -0.4 |
| Residential street, Memorial | WILCREST DR | 60.3 | 71 Active | 38 / 0 / 0 | 71.0 | -0.0 |
| Residential street near Hobby Airport | SH0035 | 54.1 | 74 Active | 32 / 1 / 11 | 74.4 | -0.4 |

Gap is HowLoud's score minus our level on their scale. Positive means they rate the place quieter than we do.

## Diagnostics: distance from one road

Twelve more points, at six distances from each demo road. They are several points near one building, so they
are reported but do not decide the status (`roles_note` in the lookups file).

| Road | Distance | Our DNL, that road only | Gap | Our DNL, all roads within 800 m | Gap | HowLoud |
|---|---|---|---|---|---|---|
| S Greenhouse Rd | 20 m | 71.2 | -0.2 | 71.2 | -0.2 | 65 |
| S Greenhouse Rd | 40 m | 66.6 | -0.6 | 66.8 | -0.5 | 67 |
| S Greenhouse Rd | 80 m | 62.0 | -0.1 | 62.5 | +0.2 | 70 |
| S Greenhouse Rd | 160 m | 57.4 | +1.4 | 58.6 | +2.0 | 74 |
| S Greenhouse Rd | 320 m | 52.4 | +2.7 | 56.3 | +4.8 | 78 |
| S Greenhouse Rd | 640 m | 46.9 | -4.3 | 60.3 | +3.0 | 74 |
| Yale St | 20 m | 64.9 | -0.6 | 65.7 | -0.1 | 68 |
| Yale St | 40 m | 60.3 | -0.0 | 63.2 | +1.5 | 71 |
| Yale St | 80 m | 55.6 | +0.4 | 61.6 | +3.7 | 74 |
| Yale St | 160 m | 50.5 | -1.3 | 60.9 | +4.3 | 75 |
| Yale St | 320 m | 44.7 | -3.5 | 60.5 | +5.1 | 76 |
| Yale St | 640 m | 38.0 | -7.1 | 61.3 | +5.5 | 76 |

- Within 160 m of the road (8 points, single road): rank correlation 0.99, median gap 0.49, largest 1.40. The line was fitted to these points, so the small gaps are partly by construction.
- All 12 distance points, single road: rank correlation 0.90, largest gap 7.08 at yale-640m.
- All 24 rows together: rank correlation 0.95, median gap 0.59, largest 7.08.

## Known limits (these are why three decisions are marked to revisit)

1. **Far from the roads it was given, the model drifts.** With only the nearest road, our level keeps falling
   with distance while HowLoud levels off, so at 640 m we read up to 7 points quieter than they do. With every
   counted road within 800 m, the same far points read up to 5.5 points louder than HowLoud, because a freeway
   several hundred metres away is included with no shielding from the buildings in between. Near the road that
   dominates, both versions agree with HowLoud. The twelve addresses sit in that well-behaved range.
2. **No background traffic** is added (interim decision 2). A unit far from any counted road gets an outdoor
   level that is too low and a Quiet Score that is too generous.
3. **Aircraft and local businesses are not in our outdoor level.** One address near Hobby Airport is included
   and agrees; its HowLoud airport component is 11, against a traffic component of 32. A location under a flight path is untested.
4. **Houston only**, and one city's roads. The line is a fit, not HowLoud's formula, which is not published.
5. **Road speeds are the inventory's maximum speed**, which may not be the posted limit.

## What each site's score measures (research S4)

| Site | Score | Scale and direction | Sources included | Lookup used |
|---|---|---|---|---|
| Apartments.com | "Sound Score", HowLoud's Soundscore under licence | out of 100 with a label; higher is quieter | vehicle traffic, airplane traffic, local sources | not read from the site: automated access is barred. HowLoud's API gives the same score |
| HowLoud | Soundscore | 0 to 100 (FAQ) or 50 to 100 (home page); higher is quieter; no published dB formula | traffic (FHWA TNM), air traffic, local businesses | official API, `GET /v2/score`, key from a local `HOWLOUD_API_KEY` |

## Reproduce

```
python -m noisemodel.crosscheck                      # evaluates docs/score_crosscheck_lookups.json, no network
HOWLOUD_API_KEY=... python tools/crosscheck_addresses.py   # rebuilds the ten addresses from TxDOT and HowLoud
```

The first line of this file is what the pipeline, the report and the UI read. It changes back to `ALERT:`
if a later run of the rules fails. Interim decisions 1 to 3 (plan 6a) are still to be revisited after the demo.
