# S4. Published sound scores: what they measure and how to look one up

Research for issue #37, task S4. Feeds the Quiet Score wording and the cross-check in
sections 6 and 6a of `docs/UNIT_PROFILE_PLAN.md` (branch `codex/unit-profile-plan`).
US housing only. No model code. Every value has a URL and an exact quote, or is marked
`unsourced`.

## Answer

**Apartments.com does not compute its own sound score.** Its "Sound Score" is HowLoud's
Soundscore, licensed. HowLoud names Apartments.com (and Homes.com, also CoStar-owned) as
customers, and Apartments.com listing pages carry the HowLoud credit and say the rating
"aggregates noise caused by vehicle traffic, airplane traffic and local sources". So one
definition covers both sites:

- **What it measures:** a modelled outdoor rating of a location (a latitude and longitude),
  "how loud a location is due to environmental noise". It is not a measurement, not an
  indoor value, and not a value for one unit or floor. HowLoud's 2015 description says the
  underlying model resolves "each side and story of a building at any hour of the day",
  but the published score is one number per location.
- **Scale and direction:** higher is quieter. HowLoud's FAQ says 0 to 100; its home page
  says 50 (very loud) to 100 (very quiet). Text labels are returned with it ("Calm",
  "Active", "Busy" are confirmed; the cut-off values are not published).
- **Sources included:** three components, each with its own number and label: vehicle
  traffic (modelled with the FHWA Traffic Noise Model), air traffic, and local sources
  (restaurants, schools, stores, gas stations). Rail is listed only as data "being
  collected"; stoplights, helicopters, buses and small airports were absent in 2015.
- **No published decibel mapping.** No source gives the formula from dB to score, the
  time metric (DNL, Leq, L24, a peak hour) or the label thresholds. The airport and
  local-source methods are "proprietary".
- **How to look one up within the terms:**
  1. **HowLoud's own API** is the only route that is official and allows batch use:
     `GET https://api.howloud.com/v2/score?lat=..&lng=..` with an `x-api-key` header,
     returning `score`, `scoretext`, `traffic`, `local`, `airports` and their text labels.
     HowLoud says "a free level of access to the API" exists. It needs an API key, which
     means someone on the team must request one; this research did not create an account.
  2. **HowLoud's map** at howloud.com accepts "a full address" in a search box, for a
     person to read by hand.
  3. **Apartments.com:** a person opens the listing page in an ordinary browser and copies
     the number, the label and the date. Automated access is not an option: the site
     returned HTTP 403 to every automated request in this research, including its
     `robots.txt` and its Terms of Service page, and the Terms (as quoted second hand)
     forbid "any robot, spider or other automatic device, or a manual process" to monitor
     or copy its pages. The safe reading is: one person, viewing listing pages for
     personal research, recording the ten or so values by hand. Anything beyond that
     needs CoStar's written permission, which the team can ask CoStar for directly since
     CoStar is the sponsor.
  4. **Realtor.com** publishes a three-level rating (high, medium, low) from the same three
     source kinds. It is coarse and its provider is not named, so it is a weak third check.

**For the cross-check (plan 6a):** the published score and our outdoor score point the
same way (higher is quieter), so the **rank correlation** is valid as planned. A
**point-by-point difference** is not, because no published source says how HowLoud turns
decibels into its 0 or 50 to 100 number. Any conversion between our 0 to 100 mapping and
theirs is `unsourced` and must be labelled as such in `docs/SCORE_CROSSCHECK.md`. Also
note that their score includes local businesses and every road the FHWA model covers,
while ours lacks local businesses and (on the point-source grid) aircraft.

## Values

Confidence: high = primary page read directly; medium = primary page seen only through a
search-index snippet, or a dated primary interview; low = secondary report.

### What the score is

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| howloud.scale.faq | 0 to 100, high = quiet | score | https://howloud.com/faqs | "A Soundscore™ rating is a number between 0 and 100 that says how loud (low score) or quiet (high score) a location is." | high |
| howloud.scale.homepage | 50 to 100, high = quiet | score | https://howloud.com/ | "a number between 50 (very loud) and 100 (very quiet)" ... "tells you how loud a location is due to environmental noise" | high |
| howloud.sources | traffic, air traffic, local | - | https://howloud.com/faqs | "A Soundscore™ rating is determined by three noise factors: vehicle traffic, air traffic and local sources (restaurants, schools, stores, etc.)." | high |
| howloud.traffic_model | FHWA TNM | - | https://howloud.com/faqs | "For the most important component — vehicle traffic — we apply the Federal Highway Authority's Traffic Noise Model." | high |
| howloud.airport_local_method | proprietary, national data sets | - | https://howloud.com/faqs | "Our methods for treating airport noise and local sources are proprietary, but treat these in a uniform way using national data sets." | high |
| howloud.uniformity | same method everywhere | - | https://howloud.com/faqs | "Our methods treat every location the same" | high |
| howloud.rail | not yet in score (stated as being collected) | - | https://howloud.com/faqs | "We're collecting data on many sources of noise or noise prevention; underground sections of road, busy train lines," | high (wording does not say whether rail is in the current score) |
| howloud.model_resolution (2015) | per side and storey, per hour | - | https://www.architectmagazine.com/design/walk-score-except-for-sound_o/ (Architect, 10 July 2015, interview with founder Brendan Farrell) | "This allows us to determine the noise level for each side and story of a building at any hour of the day." | medium (2015 interview; the published score is one number per location) |
| howloud.local_examples (2015) | gas stations, 24-hour supermarkets, bars, restaurants | - | same as above | "We add to this noise from airplane traffic, and unique local sources, like gas stations," | medium |
| howloud.no_stoplights (2015) | traffic flows freely | - | same as above | "In our model currently, traffic just flows. There is no such thing as stoplights." | medium (may have changed since) |
| howloud.missing_2015 | helicopters, buses, small airports | - | same as above | "Helicopter traffic, bus routes, and smaller airports are other noise-sources that Farrell wants to include." | medium |
| howloud.customers | Apartments.com, Homes.com, Estately, beycome.com, Staten Island Board of Realtors | - | https://howloud.com/ | customer list on home page: "Apartments.com", "Homes.com", "Estately", "beycome.com", "Staten Island Board of Realtors" | high |
| howloud.licensing | licensed to listing sites | - | https://howloud.com/faqs | "HowLoud licenses Soundscore™ to real estate listings for them to provide Soundscore™ to users directly on their sites." | high |
| apartments.sound_score.definition | traffic + airplanes + local | - | https://www.apartments.com/apartments-at-the-sound-coppell-tx/4lwx78j/ (listing page "What is a Sound Score Rating?" note) | "A Sound Score Rating aggregates noise caused by vehicle traffic, airplane traffic and local sources." | medium (read through a search-index snippet; the page returns HTTP 403 to automated fetches) |
| apartments.sound_score.display | "NN/100" with a label, e.g. 77 Calm, 65 Busy | score | https://www.apartments.com/apartments-at-the-sound-coppell-tx/4lwx78j/ and https://www.apartments.com/kurve-los-angeles-ca/047tn61/ | search-index summaries: "77/100 (Calm)" and "65/100 (Busy)" | low (values seen only in search summaries, undated; not to be used as cross-check data) |
| apartments.sound_score.components | Traffic, Airport, Businesses, each labelled | - | Apartments.com listing pages via search index | summary: "a separate breakdown for traffic, airport, and businesses noise, labeled Busy or Calm" | low (paraphrase, not a quote; confirm on a live page) |
| realtor.noise.scale | high, medium, low | category | https://www.rismedia.com/2020/03/09/its-oh-so-quiet-realtor-com-new-noise-indicator-enables-home-shoppers-to-understand-property-noise-level/ | "each property will be assigned a noise rating—high, medium or low." | medium (trade press reporting the launch) |
| realtor.noise.sources | traffic, airports, local | - | same as above | "The feature takes into account three sources of noise: traffic, airports and local sources" | medium |
| realtor.noise.method | sources combined, method not published | - | same as above | "These sources are combined to assign each property a rating." | medium |
| realtor.noise.coverage | continental US | - | same as above | "now available for properties across the continental U.S. on iOS, Android, web and mobile web." | medium (2020; current status not checked) |

### How to look one up

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| howloud.api.score_endpoint | GET /v2/score, lat and lng | - | https://api.howloud.com/docs/ | "Retrieves a soundscore for the given latitude and longitude" | high |
| howloud.api.batch | up to 250 points per POST | points | https://api.howloud.com/docs/ | "Retrieves up to 250 soundscores for the given coordinates." | high |
| howloud.api.auth | API key in `x-api-key` header | - | https://api.howloud.com/docs/ | "'x-api-key': '<YOUR API KEY>'" | high |
| howloud.api.response_fields | score, scoretext, traffic, traffictext, local, localtext, airports, airportstext | - | https://api.howloud.com/docs/ | schema: "score": "A number indicating noise levels"; "scoretext": "Descriptive text of this soundscore"; "traffic": "A number indicating traffic levels"; "local": "A number indicating local noise levels"; "airports": "Number of nearby airports" | high |
| howloud.api.sample | score 80 "Active", traffic 18 "Active", local 0 "Calm", airports 0 "Calm" | - | https://api.howloud.com/docs/ | sample response: "score": 80, "scoretext": "Active", "traffic": 18, "traffictext": "Active", "local": 0, "localtext": "Calm", "airports": 0, "airportstext": "Calm" | high (documentation example, not a real address) |
| howloud.api.free_tier | free access exists | - | https://howloud.com/faqs | "HowLoud offers a free level of access to the API." | high (limits and sign-up terms not found) |
| howloud.map.address_search | by full address | - | https://howloud.com/ | "Enter a location using a full address" | high |
| howloud.map.coverage | detailed maps only in some cities | - | https://howloud.com/faqs | "This map is very useful, but such maps are currently only available in some cities." | high |
| apartments.automated_access | HTTP 403 to automated clients | - | https://www.apartments.com/robots.txt, https://www.apartments.com/grow/about/terms-of-service | observed in this research, 2026-11-14: "Access Denied" (Akamai) on robots.txt, the Terms page and a listing page | high (direct observation) |
| apartments.terms.robots_clause | robots, spiders and manual copying barred | - | https://www.apartments.com/grow/about/terms-of-service (quoted by https://www.realtyapi.io/blog/apartments-api) | "any robot, spider or other automatic device, or a manual process" | low (second-hand quote; the primary page could not be read; the RealtyAPI page also failed DNS when fetched) |
| apartments.terms.anti_scraping | site may block scraping and extraction | - | https://www.apartments.com/grow/about/terms-of-service | search-index summary only: Apartments.com "may deploy technological measures to protect the Site against unauthorized access, use, scraping, and extraction" | low (search summary; exact wording not verified) |
| apartments.api | no public API found | - | - | - | unsourced (no official API page found) |

## Equations

No published equation links a HowLoud score to a sound level. The two relations below are
what the cross-check can and cannot do with what is published.

### E1. Rank agreement (valid with published data)

Both scales rise as the location gets quieter, so no conversion is needed:

```
rho = Spearman( our_outdoor_score[i], howloud_score[i] )   over addresses i = 1..n
```

Worked example with made-up numbers (illustration only, not data): addresses A, B, C with
our outdoor scores 30, 55, 70 and HowLoud scores 62, 71, 84 rank identically, so rho = 1.0.
If B and C swapped in the HowLoud column, the ranks would be (1,2,3) against (1,3,2),
d^2 = 0 + 1 + 1 = 2, rho = 1 - 6*2/(3*(9-1)) = 0.5.

### E2. Point difference (needs an unsourced mapping)

The plan's "within 10 points" test needs both numbers on one scale. A linear rescale from
HowLoud's 50 to 100 range onto 0 to 100 would be:

```
howloud_0_100 = (howloud - 50) * 2        # unsourced: assumes the 50-100 range is linear
```

Worked example: a HowLoud 77 maps to 54 on 0 to 100. This assumes the home-page range
(50 to 100) rather than the FAQ range (0 to 100) and assumes linearity in decibels. Neither
assumption is published. Label any result that uses it `unsourced`.

## Conflicts

1. **Scale range.** The FAQ says 0 to 100; the home page says 50 (very loud) to 100 (very
   quiet). Both are HowLoud's own pages. **Take the direction as certain (higher is quieter)
   and the range as uncertain.** Record raw values in the cross-check; do not rescale
   without labelling it. If an API key is obtained, the observed minimum over many points
   would settle which range is in use.
2. **What "Sound Score" is on Apartments.com.** The plan treats it as Apartments.com's own
   score. It is HowLoud's Soundscore under licence. A disagreement between our score and
   Apartments.com is therefore a disagreement with HowLoud's model.
3. **Location versus unit.** HowLoud's 2015 description says the model resolves each side
   and storey, but the API takes only latitude and longitude and returns one score. **Take
   the published score as one outdoor value per location**, and compare it with our
   `outdoor_free_field` at the building, as plan 6a already says.
4. **Components and our sources.** HowLoud includes local businesses and (via "airports")
   air traffic. Our point-source grid lacks aircraft and we model no local businesses. Near
   airports or commercial strips, expect their score to be lower (louder) than ours for
   reasons that are not a model error on either side.
5. **Apartments.com terms.** The primary text could not be read by an automated client, so
   the robots clause is second hand. **Take the strict reading**: no scripted access, and
   hand lookups only at the small scale plan 6a needs. If in doubt, ask CoStar.

## Not found

- **HowLoud dB-to-score formula, time metric, and label thresholds.** Not published.
  Fallback: rank correlation (E1) as the primary agreement test; any point difference uses
  E2 and is labelled `unsourced`.
- **Apartments.com Terms of Service, verbatim.** The page returned HTTP 403 to automated
  fetches. Fallback: a person reads it in a browser before the cross-check and pastes the
  relevant clause into `docs/SCORE_CROSSCHECK.md`; until then, follow the strict reading in
  Conflict 5.
- **HowLoud terms of use and API limits.** No terms page was found on howloud.com
  (`/terms` returns 404), and the free-tier limits are not on the docs page. Fallback:
  request an API key and read the terms offered at sign-up; this research did not sign up.
- **An official Apartments.com API for scores.** Not found. Fallback: HowLoud API (same
  underlying score), or hand lookup.
- **Whether Apartments.com shows the current HowLoud model version.** Not stated anywhere.
  Fallback: record both the Apartments.com value and the HowLoud value for a few addresses;
  if they differ, report both.
- **Other per-address scores.** No per-address noise score was found on Zillow, Redfin or
  Trulia. Realtor.com's high/medium/low indicator exists (2020) but its provider and method
  are not published. The BTS National Transportation Noise Map (see R1) gives a modelled
  road, rail and aviation level in dB, which is a useful like-for-like third reference
  because it is in decibels.
