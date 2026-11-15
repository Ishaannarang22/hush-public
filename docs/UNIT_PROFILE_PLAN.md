# Unit profile: the model fills it in, the client corrects it

Status: **draft for Alejandro's approval. Do not build yet.**
Owner: Alejandro. Builders: Ishaan's coding agents.
Written Sat 2026-11-14 evening, against `main` at `fd69dd3`.

## 1. What this is

Every unit gets a **unit profile**: the short list of facts about the unit and its
building that decide how loud it is inside. The model fills in the whole profile by
itself, from CoStar data, the Matterport scan, aerial data and, where nothing better
exists, a stated default. That profile produces the unit's first **Quiet Score**.

The client (a resident, an owner or a property manager) can then open the profile and
change any value to match their real unit. Each change reruns the model, and the score,
the room map and the stated range update.

Nobody is made to answer a questionnaire. The profile is complete before anyone touches
it. The client only edits what is wrong.

Why: CoStar's feedback was that property managers will supply unit details, that as
much as possible should be detected first, and that the demo should show the score
before and after. A resident whose unit scores poorly can see which assumptions that
rests on, correct the ones that do not match their unit, and see what an upgrade would do.

## 2. Decision: extend the existing model, do not build a new one

The physics does not change. A profile value is a better value for an input the model
already has, or (for sources inside the building) one new kind of source feeding an
equation the model already uses. A second model would need its own validation and would
disagree with the first.

| Piece | What it is | New physics? |
|---|---|---|
| Unit profile | The list of fields, each with a value and where it came from | No |
| Profile builder | Fills every field from data, then from defaults | No |
| Edits | A client's changes to any field, applied on top | No |
| Quiet Score | One number per room and per unit, from the model's existing results | No |
| Before and after | Auto-filled run, edited run, and the change each edit caused | No |
| "Worth checking" | Which fields would move this unit's score most if they were wrong | No |
| Building sources | Elevator, gym, pool, corridor, mechanical room, neighbours | Yes: a source in an adjacent space |

**Hard rule:** the model's existing outputs do not change. Running a property with no
profile gives byte-identical results to today, and a regression test must prove it for
both demo properties.

**Which estimate carries the score.** `main` has two room estimates: the broadband room
model in `noisemodel/` (calibrated against measured houses, includes frame leakage) and
the eight-band `RoomEnergyModel` in `web/server/` (material spectra, no leakage).
`AGENTS.md` says never to sum or fit one to the other. The score comes from
`noisemodel/` only, because it has the validation record. Profile values are also passed
to the eight-band solver as material and opening choices so the heat map moves too, but
its numbers do not enter the score.

## 3. The profile fields

Two kinds of field: facts about the unit and building (the first three tables), and the
material of each door and wall that faces out of the unit (the fourth table). Each is
filled automatically, in the order of sources shown, stopping at the first that has a
value. The last source is always a model default, so no field is ever empty.

Effect sizes are from the sensitivity tables in `docs/VALIDATION.md`. Data coverage is
from `docs/SPONSOR-DATA-INVENTORY.md`.

### Filled well by data

| Field | Filled from | Coverage | Feeds | Effect |
|---|---|---|---|---|
| Year built, and renovation year | CoStar construction events; apartment and home listings | 3,331 of 3,339 properties | Era defaults for wall, window and leakage | 1 to 2 dB |
| Building floors | CoStar stories | 3,327 of 3,339 | Receiver height; whether a roof matters | Small alone |
| Unit floor | Home listing entry-floor feature; CoStar unit record where present; else ground floor | Often | Receiver height; roof exposure on the top floor; shielding by lower buildings | Small alone |
| Window and door sizes | Matterport openings where labelled; the window survey of the scan; else 15% of the wall | Per scan | Window and door area | Up to several dB |
| Room sizes and which rooms touch | Matterport scan, through the existing loader | Per scan | Room volume; partitions | Built in |

### Filled partly by data

| Field | Filled from | Coverage | Feeds | Effect |
|---|---|---|---|---|
| Outside wall material | Home listing feature ("brick exterior"); CoStar construction class (masonry, wood frame, concrete, steel); else era default | Class known for about 74% of properties. It describes the structure, not the cladding | Wall rating | Under 0.5 dB when the wall has windows |
| Walls and floors between units | Inferred from the CoStar construction class; home listing "no common walls" and shared-wall count; else stud wall | An inference, not a record | Rating of party walls and floors, for building sources | Decides neighbour and gym noise |
| What the building has | CoStar amenities list: elevator, pool, gym, laundry, garage | Says whether, not where | Whether building sources apply at all | See section 5 |
| Through-wall or window air conditioner | Home listing HVAC feature; else none | Rare | An extra opening in an outside wall | To research |
| Room finish | Home listing flooring feature (tile, wood, carpet); else furnished default | Rare | Reverberation time per room | About 1 dB |

### Usually not in any data

| Field | Filled from | Feeds | Effect |
|---|---|---|---|
| What each side of the unit faces | Detached house: aerial map, every side is outdoors. Apartment: a side with a scanned window or outside door is outdoors; the entry-door side is the corridor; the rest are "unknown" and treated as not outdoors | Wall exposure; which road each wall faces; a check on compass north | Up to 9 dB |
| Window type | Home listing feature ("double pane windows", in 79 of about 1,900 listings); else era default | Window rating | 2 to 9 dB |
| Where the elevator, gym or pool is, relative to this unit | Nothing. Default: not adjacent | Building sources | See section 5 |
| Windows open at night | Nothing. Default: closed | Window state overnight | About 12 dB when open |

### Materials of the doors and walls that face out of the unit

This is where units differ most and where data knows least, so it is the main place a
resident or owner adds something. One field per element, for every door and wall that
leads out of the unit: to outdoors, or to a shared corridor. The scan supplies the list
of elements and their sizes, so the client only picks a material for each. Example: a
house with a glass back door and a wooden front door with a metal plate gets two door
fields, one set to "sliding glass" and one to "solid wood", the closest choices the
model has today.

Interior doors and interior walls are not listed here. They keep one default each
(a hollow wooden door, a stud wall) and stay under "advanced".

| Field, one per element | Choices | Filled from | Feeds | Effect |
|---|---|---|---|---|
| Each outside door | Hollow wood; solid wood; sliding glass; solid wood with a storm door | The scan: a wide opening onto a balcony or yard defaults to sliding glass, the entry door to solid wood. Home listing "insulated doors" where present | Door rating for that door | Large. A door is often the weakest part of its wall: in the demo unit the sliding door carries 90% of the living room's sound |
| Each outside-facing wall | Brick veneer; concrete block; cement stucco; synthetic stucco; vinyl siding; aluminium siding; fibre cement | The building-level "outside wall material" field above, which the client can then override wall by wall | Wall rating for that wall | Small when the wall has a window or door, larger for a blank wall |
| The entry door, when it opens onto a corridor | Same door choices | Default solid wood | The path for corridor noise (section 5) | Decides corridor noise |

The choices are exactly the door and wall types that already have a rating in
`assumptions.yaml` (`doors_exterior.*` and `walls.*`). No new ratings and no research are
needed. Other materials (metal-faced, fiberglass, full glass) can be added later by
adding a rated entry to that file; the field picks it up with no code change.

### Not shown as fields, but still editable under "advanced"

Frame leakage (set by era), interior doors (assumed closed at night, hollow core), and
every key in `assumptions.yaml`. They keep their defaults unless someone opens the
advanced section. They are not part of the profile a client sees first.

Dropped from the earlier draft at Alejandro's direction: the window-seal question, the
interior-door questions, confirming window size, the sliding-door seal, and "what do you
hear most". Added at his direction: the material of each outward-facing door and wall.

## 4. Where each value came from

Every field carries one label, shown as a small tag next to the value:

| Label | Meaning | Example |
|---|---|---|
| `scan` | Measured from the Matterport scan or a survey of it | Bedroom window 1.60 by 1.59 m |
| `costar` | From the CoStar export | Built 2014, 3 floors, masonry |
| `map` | From aerial or traffic data | East side faces S Greenhouse Rd |
| `inferred` | Worked out from another field | Stud party walls, from "wood frame" |
| `assumed` | A model default | Double-pane windows, from the era |
| `edited` | A client changed it. Records who and when | "Laminated", resident |

Rules:

- An `edited` value always wins, and the value it replaced stays in the log.
- A building fact edited by a manager applies to every unit in that building. A unit
  fact edited by a resident applies to that unit only.
- **Range.** A room's stated range is plus or minus 5 dB while its window type or its
  exposure is `assumed`, `inferred` or unknown, and plus or minus 3 dB once both are
  `scan`, `costar`, `map` or `edited`. It never goes below 3 dB.
- **Sanity checks.** An impossible edit (a window larger than its wall, a unit floor
  above the number of floors) is rejected with a plain message. An unlikely one
  (laminated glass throughout a 1960s building) is accepted and flagged.
- **A missing listing feature is not a "no".** If a listing does not mention double-pane
  windows, the field falls through to the era default. It is not set to single pane.

## 5. Building sources (the one piece of new physics)

For apartments and hotel-like buildings: a noisy space on the other side of a wall,
floor or ceiling. It uses the model's existing room-to-room relation, with the noisy
space as the sending room:

```
L_room = L_source_space - (rating_of_partition - derating) + 10*log10(S_partition / A_room)
```

Inputs per source: which room it borders, through which surface (wall, floor, ceiling)
and over what area, the kind of space, its level, and its active hours. It appears in
the results as its own source (`building`) with its own share, next to road and
aircraft, so the report can say "the gym below is 40% of this bedroom's evening level".

By default no building source is adjacent to a unit, because no data says where they
are. When CoStar lists an elevator, gym or pool for the building, the profile shows
"this building has a gym: is it next to, above or below this unit?" as a field worth
checking (section 7).

Two limits to state in the output:

- **Airborne sound only.** Footsteps and dropped weights travel through the structure,
  which this relation does not cover. The model must say so wherever a gym or an
  upstairs neighbour is selected.
- **Source levels and partition ratings need sources.** No level for an elevator, gym,
  pool, corridor or mechanical room is in the research yet. Until research S1 lands,
  each ships as a `placeholder` and the UI shows it as such.

Outdoor equipment uses the `mechanical` source type already on `main`.

## 6. The Quiet Score

There is no score in the repo today. Proposal, with every number in `assumptions.yaml`
under `score.*` so it can be changed without touching code:

- **Room score, 0 to 100.** Linear between a "silent" level and a "very loud" level.
  Bedrooms use the overnight level: 100 at 20 dBA or below, 0 at 50 dBA or above, so the
  WHO sleep guideline of 30 dBA is a score of 67. Other rooms use the daily level (DNL):
  100 at 30 or below, 0 at 60 or above, so the HUD limit of 45 is a score of 50.
- **Unit score.** 60% the lowest-scoring bedroom, 40% the main living room. With no
  bedroom, the living room alone.
- **Range.** Shown with the range the level range implies: "62, likely 55 to 70".
- **What it is not.** An indoor score for one unit. Published scores such as the one on
  Apartments.com rate the location outdoors, so the two will differ for good reasons.
  The UI should say so in one line. Section 6a checks that our outdoor picture agrees
  with theirs.

CoStar's example was a change "from 10 to 15". If they use a different scale, only the
`score.*` values change.

## 6a. Cross-check the score against published sound scores (required, and alert us)

**To the agent: do this before the score is shown in any demo, and tell Alejandro and
Ishaan the result either way.**

Compare our scores with the sound scores other websites publish for the same addresses.
Apartments.com is the priority, because CoStar owns it and its score is the one their
team will compare ours to. Also check at least two others that publish a per-address
noise or sound score (for example HowLoud's Soundscore, and any listing site that shows
one). Record for each site what its score measures and its scale; S4 covers this.

How:

1. **Addresses.** The demo apartment (2219 Greenhouse Rd), 2125 Yale St, and at least
   eight more from the CoStar set that span quiet to loud: next to a freeway, on an
   arterial, on a side street, near an airport. Ten addresses at minimum.
2. **Look each one up by hand, or through an official API if the site offers one.** Do
   not scrape in bulk or get around a site's access controls or terms. Record the
   score, the date, and the page it came from.
3. **Compare like with like.** The published scores rate the location outdoors. Ours
   rates one unit indoors. So compute two numbers per address from our model:
   - an **outdoor score**: the same 0 to 100 mapping applied to our outdoor free-field
     daily level at the building (`outdoor_free_field`), then converted to the other
     site's scale and direction. This is the like-for-like comparison.
   - our **Quiet Score** for the unit, for reference.
4. **Measure agreement** on the outdoor score: the difference at each address after
   putting both on the same scale, and whether the two rank the addresses in the same
   order (rank correlation).

"Close enough" (placeholders in `assumptions.yaml` under `score.crosscheck.*`, for
Alejandro to confirm): the median difference is within 10 points on a 100-point scale,
no address differs by more than 20, and the rank correlation is 0.7 or higher.

**If it is not close enough, alert us. Do not adjust the score to make it match.**

- Write `docs/SCORE_CROSSCHECK.md` with the table and, at the very top, either
  `RESULT: within tolerance` or `ALERT: outside tolerance`, followed by which addresses
  disagree, by how much, in which direction, and the most likely reason (their score
  includes sources ours lacks, such as aircraft or local businesses; a wrong road count
  or speed in ours; different scale anchors).
- Post the same summary as a comment on the build issue, tagging @Jandr07 and
  @Ishaannarang22, with the word ALERT in the first line when it is outside tolerance.
- Add a `score_crosscheck` entry to the pipeline response and a one-line notice in the
  report and UI when the last cross-check was outside tolerance, so the score is never
  shown as settled while it disagrees with published scores.

The decision on what to change (the score's anchors, its weighting, or missing noise
sources) is Alejandro's. The agent reports; it does not retune.

If a site's score cannot be looked up at all (blocked, login required, no score shown
for that address), say so in the file and count that address as missing, not as a pass.

### Decisions taken on Sat 2026-11-14, for now (Alejandro). Revisit after the demo

A first comparison with HowLoud's API (issue #36) led to three interim decisions. They
replace the matching parts of this section until they are revisited.

| # | Decision for now | Why | Come back to |
|---|---|---|---|
| 1 | **No outdoor score is shown.** The outdoor level stays in decibels and is compared with published scores by ranking. The fitted line `HowLoud = 103.6 - 0.54 x DNL` is kept in `docs/SCORE_CROSSCHECK.md` as a diagnostic only, labelled as fitted to 8 points on 2 roads. The plan's outdoor anchors (DNL 30 = 100, 60 = 0) are dropped: they scored both demo addresses 0 | The outdoor score is not the product, and a number fitted to theirs overstates what has been shown | Whether to show an outdoor score at all, and if so on our own scale anchored to public limits (for example 100 at 45 dB, 0 at 85 dB) or on HowLoud's |
| 2 | **Background traffic is not added.** The report and the cross-check file state the limit: the model counts only the roads it is given, so a unit far from any counted road gets an outdoor level that is too low and an indoor score that is too generous | The two demo units sit next to their roads and are not affected; a floor would move validated results | Add a city background floor (one sourced value, off by default), then counting every road within about a kilometre |
| 3 | **Tolerance is ranking plus a small gap.** Rank correlation of 0.8 or better across at least ten separate addresses, and on HowLoud's scale a median gap of 2 points or less and no gap above 5 points. This replaces "median 10, maximum 20, rank 0.7" | HowLoud's scale moves about half a point per decibel, so 10 points was about 18 dB | The exact numbers, once ten separate addresses have been compared |

With these, today's twelve points split as they should: the eight within 160 m of a
road pass (median gap 0.5, largest 1.5), and all twelve fail on the largest gap (7.0),
which is the background-traffic limit in decision 2. A pass still needs ten separate
addresses with their own road inputs; only two have them.

## 7. Worth checking, and what changed

- **Worth checking.** For each field that is not `scan` or `edited`, rerun the model
  once per plausible alternative value and take the spread in unit score. List the
  fields with the largest spread first, with a line such as "Window type is assumed.
  It could move your score by up to 14 points." A whole ranking is a few dozen runs at a
  few milliseconds each (`with_fixes=False`). This replaces a fixed questionnaire: each
  unit is shown the two or three fields that matter for it.
- **What changed.** Apply the edits one at a time in the order made, rerun, and record
  the score change each caused: "Windows are laminated: +9", "Unit faces the courtyard,
  not the road: +21".
- **Honesty.** An edit can lower the score. It is reported the same way.

## 8. Improve it

The model already searches for the best single fix. Extend the list and report each as
a score change and a level change: seal the window frames, add a storm window, replace
with laminated glass, fit a solid-core bedroom door, add rugs and heavy curtains, keep
the window closed at night. Each is a rerun with one change. Sealing stays on the list
even though window seal is not a profile field.

## 9. Interface

**Data in.** CoStar's raw export stays out of Git (`AGENTS.md`). The pipeline already
reads a local context file, `work/costar-kit/selected-acoustic-context.json`, through
`DatasetRepository.context()`, which today returns only name, stories and construction
material. Extend that context record with: completion and renovation year, amenities,
unit floor where known, and the listing features in section 3. When the file or a value
is missing, the field falls through to its default. Tests use a small made-up context
file in `tests/`, never sponsor data.

**Python.** New module `noisemodel/profile.py`:

```
build(prop, sources, context=None)     -> profile: every field with value, label, source note, alternatives
apply(prop, sources, profile, edits)   -> (prop2, sources2, log)   never mutates its inputs
score(result)                          -> {"unit": {...}, "rooms": {...}}
worth_checking(prop, sources, profile) -> fields ranked by possible score change
compare(prop, sources, profile, edits) -> auto-filled result, edited result, per-edit changes, upgrades
```

The field list lives in one file, `noisemodel/profile_fields.yaml`: field id, label,
allowed values, which property field, source entry or `assumptions.yaml` key each value
sets, and the fill order. The UI renders the profile from this file through the
pipeline, so labels and options exist once.

**The edits file.** One JSON document per unit:

```json
{
  "schemaVersion": 1,
  "modelId": "zzvymDx5ty7",
  "edits": [
    {
      "field": "window_type",
      "target": "wall:z6q9f2tfcd3aumsmgkzh94ssb",
      "value": "laminated_acoustic",
      "edited_by": "resident",
      "edited_at": "2026-11-14T19:40:00-05:00"
    }
  ]
}
```

`target` is omitted for whole-unit and whole-building fields.

**Pipeline.** `noisemodel/pipeline.py` returns `profile` and `score` for every run. With
an optional `edits` in the request it also returns `baseline`, `changes` and
`worthChecking`. All other fields of the response are unchanged.

**Command line.** `python -m noisemodel.predict <property> <sources> --profile --edits edits.json --report`
adds "Unit profile" and "Before and after" sections to the report.

**The other solver.** The TypeScript pipeline maps the same profile onto its own
`scenario` (wall, window and floor materials, per-surface materials) and opening
states. Its numbers stay separate from the score.

## 10. UI flow (for the agents building the front end)

1. Opening a unit shows the Quiet Score with its range, and one line such as
   "8 values from data, 4 assumed".
2. **Unit profile** is a panel listing every field with its value and its source tag.
   Nothing needs filling in.
3. The two or three "worth checking" fields sit at the top with what they could change.
4. Clicking any value turns it into a control (a choice list, a number, or for wall
   exposure, clicking the wall in the 3D view). Outside doors and walls are picked the
   same way: click the door or wall in the 3D view, or its row in the list, and choose
   its material. On change, the score, the room colours
   and the "what changed" list update at once. A changed field shows the `edited` tag
   and an undo.
5. A toggle switches the map between "from data" and "with your changes".
6. **Improve it** lists upgrades with their score change.
7. **Share** exports the edits file. A manager's building-level edits can be applied to
   every unit in that building.

## 11. Research needed before the parts that depend on it

Each is one file in `research/`, in the same shape as R1 to R10.

| Id | Question | Blocks |
|---|---|---|
| S1 | Typical A-weighted levels inside an apartment gym, pool room, laundry, corridor, elevator machine room and mechanical room, and typical ratings of party walls and floors by construction class | Section 5 |
| S2 | How much sound a through-wall air conditioner, a window unit and a wall vent let in | That field |
| S3 | Reverberation time by floor covering and furnishing | Room finish, beyond the current default |
| S4 | How existing sound scores are defined (Apartments.com first, then HowLoud and others): what they measure, their scale and direction, and which noise sources they include | Sections 6 and 6a |
| S5 | Whether impact noise from above can be estimated from floor construction, or must stay out of scope | Section 5 limit |
| S6 | What a CoStar construction class implies for outside walls and party walls in Houston and Los Angeles apartments, by era | The two `inferred` fields |

## 12. Build order

Sized for the time left before the deadline. Each phase leaves something demoable.

| Phase | What | Needs research? |
|---|---|---|
| A | Quiet Score and its cross-check against published scores (section 6a), which runs as soon as the score exists. Field list, profile builder with scan and default sources, per-element door and wall materials using the ratings already in `assumptions.yaml`, edits, labels, Quiet Score, before and after, "worth checking", pipeline and command-line options, tests | No |
| B | CoStar pre-fill: extend the local context record and wire year built, floors, unit floor, construction class, amenities and listing features into the builder | No (S6 refines it) |
| C | UI panel (section 10) on the demo apartment, with the before and after toggle | No |
| D | Building sources and the through-wall field | S1, S2, S5 |
| E | Upgrade list with score changes; building-level edits reused across units | S3 for finer steps |

Phases A and C alone deliver CoStar's demo idea: an auto-filled profile, a quick
correction by the owner, then the old score, the new score, and why. Phase B is what
makes the profile arrive mostly filled.

## 13. Tests and done criteria

- **No profile, no change.** Both demo outputs identical to `main`.
- **Auto-fill.** With a context record, each field takes the value and label of the
  first source that has one. With no context, every field is `scan`, `map`, `inferred`
  or `assumed`, and none is empty. A missing listing feature never becomes a "no".
- **Auto-filled run equals today's run** on the demo apartment when the context adds
  nothing the model did not already use, so introducing the profile does not move the
  existing numbers by itself. Where CoStar data does change an input (for example
  2014 construction, 3 floors, masonry for Volterra), the report states each change.
- **Each field.** For every field and allowed value: the right input changes, and the
  result moves in the right direction (single pane is louder than laminated; a side
  marked "neighbouring unit" stops letting outdoor sound in; window open is louder).
- **Per-element materials.** The profile lists exactly the doors and walls that face
  out of the unit, and no interior ones. Changing one door's material changes only
  that door's rating: on a unit with two outside doors, setting one to glass leaves the
  other's contribution unchanged. A wall-by-wall override beats the building-level
  wall material for that wall only. Every choice offered has a rating in
  `assumptions.yaml`; the list is read from that file, not typed twice.
- **Labels.** Every field carries a label; an edit wins; the replaced value stays in
  the log; a manager's building edit reaches every unit of that building.
- **Score.** 30 dBA overnight in a bedroom scores 67; DNL 45 in a living room scores 50;
  values clamp at 0 and 100; a louder room never scores higher.
- **Cross-check (section 6a).** `docs/SCORE_CROSSCHECK.md` exists with at least ten
  addresses, its first line is `RESULT:` or `ALERT:`, and the issue comment was posted.
  A test covers the tolerance logic with made-up scores: inside tolerance gives
  RESULT, one address 25 points off gives ALERT, a missing lookup is not a pass.
- **Worth checking.** A field whose every alternative gives the same result ranks last.
  A `scan` or `edited` field is never listed.
- **Changes.** The per-edit changes sum to the total change.
- **Bad edits.** Impossible edits are rejected with a message.
- **Building sources (phase D).** A source behind a wall raises the rooms it borders;
  a heavier partition lowers it; outside its hours it contributes nothing.
- **Existing suites.** `python3 -m pytest -q`, `npm run test:acoustics` and
  `npm run build` all pass.

Deliverables: `noisemodel/profile.py`, `noisemodel/score.py`,
`noisemodel/profile_fields.yaml`, `samples/profile.zzvymDx5ty7.json`,
`samples/edits.zzvymDx5ty7.example.json`, "Unit profile" and "Before and after"
sections in `docs/DEMO_RESULTS.md`, `docs/UNIT_PROFILE.md` describing the profile
and the edits file for integrators, and `docs/SCORE_CROSSCHECK.md` (section 6a).

## 14. From the CoStar conversation, and where each idea lands

| Their point | In this plan |
|---|---|
| Detect what you can, then fill gaps with estimates | The profile builder: scan, CoStar, map, inference, then a stated default |
| Managers will supply door material, window type, floor, side of building | Any field can be edited; building-level edits apply to every unit |
| Elevator, gym above or below, pool, highway side | "What each side faces" and section 5. CoStar's amenities list says whether to raise them |
| Higher floors are usually quieter; CoStar data has the floor | Unit floor, pre-filled. The model's own floor effect is small unless something shields the lower floors, and the plan does not promise more |
| Landlord interview, then old against new map and score | Sections 7 and 10, without an interview: the owner corrects a filled-in profile |
| Sound emitter outside during the scan, recorded inside | The existing field test mode and `fieldtests/near_speaker.py`. Not built here; noted as the calibration step |
| Wall thickness from the 3D mesh | Matterport edge thickness is already in the saved scans. A thickness-to-construction guess could feed the two `inferred` wall fields; left as a follow-up |

## 15. Out of scope

Accounts and logins. Storing edits on a server. Photo recognition of windows or
materials. Impact noise. Any change to how outdoor levels are computed. Committing any
CoStar raw data.
