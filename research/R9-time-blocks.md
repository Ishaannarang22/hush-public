# R9. Traffic share by time block

Research for issue #19. Checks the simple form in section 2.1 of `docs/NOISE_MODEL_PLAN.md`
(splitting a BTS 24-hour LAeq into the five blocks of section 1).
All URLs were opened and all data files were downloaded on 2026-11-14.

Blocks: `overnight` 00-06, `morning_rush` 06-10, `midday` 10-16, `evening_rush` 16-20,
`evening` 20-24.

## Answer

The best primary source is TxDOT's own continuous count stations, as TxDOT reports them to
FHWA every month (FHWA TMAS hourly volume files). I used the 2025 Texas files for January,
April, July and October (one month per season), all days of the week, because BTS is built
on AADT, which is an all-days average.

Freeways come from the 14 urban Interstate and freeway stations in the TxDOT Houston
district. Arterials come from all 47 urban principal and minor arterial stations in Texas.
The Houston district has only 3 arterial stations, all suburban state highways. Their result
agrees with the statewide one to within 0.5 dB, and is shown as a check.

**Deliverable: offset of each block's Leq from the 24-hour LAeq (BTS value).**
`L_block = L24 + offset`.

| block | hours | freeway share of daily vehicles | freeway offset (dB) | arterial share of daily vehicles | arterial offset (dB) |
|---|---|---|---|---|---|
| `overnight` | 00-06 | 9.0% | **-4.4** | 6.6% | **-5.8** |
| `morning_rush` | 06-10 | 20.8% | **+1.0** | 20.3% | **+0.9** |
| `midday` | 10-16 | 34.5% | **+1.4** | 36.3% | **+1.6** |
| `evening_rush` | 16-20 | 23.5% | **+1.5** | 26.6% | **+2.0** |
| `evening` | 20-24 | 12.2% | **-1.4** | 10.2% | **-2.1** |

Freeway: Houston district, FHWA functional class 11 and 12, 14 stations, 174.8 million
counted vehicles. Arterial: Texas urban, functional class 14 and 16, 47 stations,
69.4 million counted vehicles. The offsets assume a constant vehicle mix and speed over the
day (equation E1). Trucks break that assumption a little (question 2, below).

An independent Houston source agrees. TTI's hourly travel factors for the
Houston-Galveston-Brazoria region (TxDOT ATR data 2013 to 2022, summer weekday, all road
types) give -4.9 / +1.5 / +1.2 / +1.7 / -1.9. The TMAS Houston freeway stations on
Tuesday to Thursday only give -4.3 / +1.4 / +1.2 / +1.5 / -1.8, within 0.6 dB in every block.

**Question 2, trucks.** Yes, the truck share changes with time of day. In TTI's 2025 VMT mix
for the Houston TxDOT district, combination trucks are 3.4% of freeway VMT in the PM peak
and 7.1% overnight (arterials: 3.6% and 8.5%). Single-unit trucks peak at midday (4.7% on
freeways). Trucks are spread more evenly over the day than cars, so they make up more of the
traffic at night. TTI's 1989 Houston study says the same thing in words. Because a truck is
louder than a car, the night offset in acoustic energy will be somewhat less negative than
the vehicle-count offset above. The size of that correction needs the truck-to-car emission
difference from R7, so it is given here as an equation (E3) and not as a number.

**Question 4, HUD 15%.** On Houston freeways, 18.8% of daily vehicles travel between 22:00
and 07:00. The figure for Texas urban freeways is 17.5%. On Texas urban arterials it is 14.4%.
So HUD's 15% fits arterials. For freeways it is about 4 points low. That makes DNL
0.6 dB too low (L24 + 4.3 from the data, against L24 + 3.7 under HUD) and the night level
1.0 dB too low (L24 - 3.0 against L24 - 4.0). The plan's placeholder `overnight` = L24 - 4.0
lands on the freeway value (-4.4) within 0.4 dB. It is 1.8 dB too high for arterials.

**Question 5, rail.** Houston data exists, but only as a 12-hour split. The FRA crossing
inventory records daytime (06:00 to 18:00) and nighttime (18:00 to 06:00) through-trains
for every crossing. For the 425 Houston crossings with 2025 counts, 48.4% of through-train
passages are at night. So rail is close to flat over the day. Spread evenly within each
12-hour half, the offsets are -0.1 / +0.1 / +0.1 / 0.0 / -0.1. This also means HUD's 15%
night share does not fit Houston rail: a flat profile gives about 37% between 22:00 and 07:00.
No hourly Houston rail data was found.

## Values

### Sources

- [TMAS] FHWA Travel Monitoring Analysis System, continuous count data page:
  https://www.fhwa.dot.gov/policyinformation/tables/tmasdata/ . Files used:
  https://www.fhwa.dot.gov/policyinformation/tables/tmasdata/2025/2025_station_data.zip and
  `.../2025/jan_2025_ccs_data.zip`, `apr_2025_ccs_data.zip`, `jul_2025_ccs_data.zip`,
  `oct_2025_ccs_data.zip` (Texas members `TX_2025 (TMAS).STA`, `TX_<Mon>_2025 (TMAS).VOL`).
- [FC] FHWA HPMS data item descriptions, functional system codes: https://www.fhwa.dot.gov/ohim/did88_92.cfm
- [TTI25] TTI for TCEQ, *HGB, DFW and Bexar County Nonattainment Areas RFP On-Road Emissions*, 2025:
  https://www.tceq.texas.gov/downloads/air-quality/research/reports/on-road/5822343431013-20250521-houston-galveston-brazoria-hgb-dallas-fort-worth-dfw-and-bexar-county-nonattainment-areas-rfp-on-road-emissions.pdf
  Page numbers are the report's own footers.
- [TTI89] Walters, Poe and Stokes, *Development of Planning Values for Urban Freeways in Large
  Texas Cities*, TTI Research Report 1196-1, FHWA/TX-90/1196-1, November 1989:
  https://library.ctr.utexas.edu/hostedPDFs/tti/1196-1.pdf
- [FRA] FRA Crossing Inventory Data (Form 71), Current, on data.transportation.gov:
  https://data.transportation.gov/Railroads/Crossing-Inventory-Data-Form-71-Current/m2f8-22s6
  (API: https://data.transportation.gov/resource/m2f8-22s6.json ; column metadata:
  https://data.transportation.gov/api/views/m2f8-22s6.json)
- [HUD] 24 CFR 51.106: https://www.ecfr.gov/current/title-24/subtitle-A/part-51/subpart-B/section-51.106
  and R1 (`research/R1-outdoor-levels.md`, section "Day, night and DNL").

### Q1. Hourly distribution and block shares, roads

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| What TMAS volume files are | hourly volumes from state continuous counters, reported monthly | - | [TMAS] | "State highway agencies collect traffic volume data" ... "report their continuous counting data to FHWA on a monthly basis" | high |
| File format | pipe-delimited, 2001 TMG layout, columns `Hour_00` to `Hour_23` | - | [TMAS] | "Data listed here are reported by states following data format prescribed in FHWA's 2001 Traffic Monitoring Guide" | high |
| Functional class codes used | 11 urban Interstate, 12 urban other freeway/expressway, 14 urban other principal arterial, 16 urban minor arterial | - | [FC] | "Code 11 = Principal Arterial --Interstate", "Code 12 = Principal Arterial --Other Freeways and Expressways", "Code 14 = Other Principal Arterial", "Code 16 = Minor Arterial" | high |
| Houston district freeway stations (FC 11, 12) | 14: IH 10 (00A125, 00S155, 00S165), IH 610 (00A156, 00S157, 00S182), US 59 (00A226, 00S140, 00S174), IH 45 (00A316, 00S204), US 290 (0000S3), SH 146 (00S107), SH 249 (00S258) | stations | [TMAS] station file, county codes 201 Harris, 339 Montgomery, 167 Galveston | station file row, e.g. "IH 10, 0.4 MILE EAST OF SS 330" | high |
| Houston freeway hourly share, hours 00 to 23, all days 2025 (4 months, pooled) | 1.26 0.90 0.86 0.88 1.58 3.57 5.09 5.37 5.21 5.15 5.29 5.50 5.70 5.78 5.98 6.23 6.36 6.20 5.83 5.07 4.13 3.45 2.73 1.89 | % of daily vehicles | [TMAS] | computed, see E1; 174,767,709 vehicles | high (data); medium (4 months, not 12) |
| Houston freeway block shares | 9.04 / 20.82 / 34.48 / 23.46 / 12.20 | % | [TMAS] | computed | high |
| Houston freeway, spread over the 14 stations | `overnight` 5.3 to 11.9 (median 9.8); `evening_rush` 21.4 to 26.6; `evening` 6.7 to 14.8 | % | [TMAS] | computed | high |
| Texas urban arterial stations (FC 14, 16) | 47 stations, 69,375,605 vehicles | - | [TMAS] | computed | high |
| Texas urban arterial hourly share, hours 00 to 23, all days 2025 (pooled) | 0.88 0.58 0.54 0.64 1.28 2.73 4.26 5.64 5.34 5.04 5.19 5.61 6.07 6.08 6.34 7.01 7.64 7.81 6.39 4.78 3.74 2.93 2.11 1.39 | % of daily vehicles | [TMAS] | computed, see E1 | high (data); medium (statewide, not Houston) |
| Texas urban arterial block shares | 6.64 / 20.27 / 36.30 / 26.62 / 10.17 | % | [TMAS] | computed | medium |
| Texas urban arterial, spread over 47 stations | `overnight` 0.6 to 14.6 (median 6.0); `evening_rush` 21.7 to 30.7 | % | [TMAS] | computed | medium |
| Houston district arterial check (3 stations: SH 35 south of Beltway 8, FM 518 west of IH 45, SH 197 north of SH 146) | 6.00 / 21.30 / 36.04 / 27.46 / 9.19, offsets -6.2 / +1.1 / +1.6 / +2.2 / -2.6 | %, dB | [TMAS] | computed | low (3 suburban stations) |
| Texas urban freeway, all 71 stations (check) | 8.28 / 20.64 / 35.29 / 24.04 / 11.75, offsets -4.8 / +0.9 / +1.5 / +1.6 / -1.5 | %, dB | [TMAS] | computed | high |
| HGB hourly travel factors, all roads, summer weekday, hours 00 to 23 | 0.009113 0.006064 0.0056 0.006553 0.014161 0.038732 0.061036 0.064849 0.056737 0.051163 0.050106 0.052103 0.054269 0.055052 0.057982 0.063397 0.068096 0.070337 0.060076 0.047264 0.036536 0.030712 0.023867 0.016195 | fraction of daily VMT | [TTI25] p.39-40, Table 24 "Base factor" column | "Table 24. HGB 8-County TDM Area Summer Weekday Time Period Hourly Travel Factors." | high |
| How TTI built those factors | TxDOT ATR stations, 2013 to 2022, combined per region | - | [TTI25] p.37 | "These hourly travel factors were developed using multi-year (2013 through 2022) aggregated ATR station data for each region." | high |
| HGB block shares from Table 24 | 8.02 / 23.38 / 33.29 / 24.58 / 10.73, offsets -4.9 / +1.5 / +1.2 / +1.7 / -1.9 | %, dB | [TTI25] Table 24 | computed, see E1 | high (weekday, all road types mixed) |
| FHWA TMG national default hourly profile | none found; the TMG asks states to build time-of-day factors from their own counters | - | https://www.fhwa.dot.gov/policyinformation/tmguide/tmg_2022/traffic-data-methodologies.cfm | "TOD adjustment factors are needed to convert partial day counts to estimates of daily traffic" | low (only the first part of the chapter was read) |

### Q2. Truck share by time of day

[TTI25] Appendix C gives the 2025 weekday VMT mix for the Houston TxDOT district by MOVES
road type and four periods. RT4 = urban restricted access (freeways). RT5 = urban
unrestricted access (arterials and below). I summed MOVES source types 61 and 62
(combination trucks) and 51 to 54 (single-unit trucks). Each column sums to 1.0000.

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| Combination trucks, urban freeway (RT4): AM / mid-day / PM / overnight | 4.74 / 6.38 / 3.39 / 7.05 | % of VMT | [TTI25] p.107, "2025 Weekday VMT Mix – Houston TxDOT District (2023, 2024, 2026, and 2027 Activity Scenario)" | row "62_D": RT4 values "0.02997", "0.04034", "0.02144", "0.04456" (AM, mid, PM, overnight) | high |
| Single-unit trucks, urban freeway (RT4) | 4.01 / 4.72 / 2.49 / 2.51 | % of VMT | same | row "52_D": RT4 values "0.02251", "0.02650", "0.01401", "0.01411" | high |
| Combination trucks, urban arterial (RT5) | 4.35 / 6.49 / 3.59 / 8.51 | % of VMT | same | row "61_D": RT5 values "0.03256", "0.04863", "0.02691", "0.06369" | high |
| Single-unit trucks, urban arterial (RT5) | 3.33 / 4.42 / 2.46 / 2.32 | % of VMT | same | summed rows 51 to 54 | high |
| HGB period hours for the VMT mix | AM 07-10, mid-day 10-16, PM 16-20, overnight 20-07 | h | [TTI25] p.83, footnote 2 under Table 45 | "AM peak – three hours of 7 a.m. to 10 a.m.; mid-day – six hours of 10 a.m. to 4 p.m.; PM peak – four hours of 4 p.m. to 8 p.m.; and overnight – eleven hours of 8 p.m. to 7 a.m." | medium (Table 24 uses 6-9 for the HGB AM peak, see Conflicts) |
| Truck volume over the day, urban freeway | nearly flat; diluted by cars in the peaks | - | [TTI89] p.50 | "The truck volume does not vary significantly during the day; however, the truck volume is diluted by the passenger car volume during the peak hours" | high (1989) |
| Houston peak-hour truck share, urban freeways | 3.8 overall, 3.3 radial; I-610 west 1.5, I-610 east 8.2 | % | [TTI89] p.56 | "Analysis of the results indicates an overall peak hour truck percentage of 3.8 percent, 3.3 percent on radial." | medium (1986 counts) |
| Peak-hour truck share as a fraction of the 24-hour share, urban freeways | 0.49 (radial 0.46, circumferential 0.55); TxDOT D-10 factor for Interstates 0.45 | ratio | [TTI89] p.56, Table 8 p.50 | "the four-year data base yields a factor of 0.49 for all urban freeways, 0.46 for radial, and 0.55 for circumferential" | medium (1984 to 1987) |

### Q4. HUD night share check

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| HUD default night share (22:00 to 07:00) | 15 | % of ADT | R1, and [HUD] 51.106(a)(2) | "the traffic flow between 10 p.m. and 7 a.m. does not exceed 15 percent of the average daily traffic flow" | medium (see R1) |
| Houston freeway night share, 22:00 to 07:00 | 18.8 (stations 13.3 to 20.9, median 19.4) | % | [TMAS] | computed | high |
| Texas urban freeway night share | 17.5 | % | [TMAS] | computed | high |
| Texas urban arterial night share | 14.4 (stations 4.8 to 23.5, median 14.0) | % | [TMAS] | computed | medium |
| HGB all-roads night share, summer weekday | 18.1 | % | [TTI25] Table 24 | computed | high |

### Q5. Rail

| name | value | unit | source URL | exact quote | confidence |
|---|---|---|---|---|---|
| FRA day/night fields | day through-trains 06:00 to 18:00, night through-trains 18:00 to 06:00 | trains per day | [FRA] column metadata | "Total Day Thru Trains (6 AM to 6 PM) [Box #II.1.A on Form 6180.71]"; "Night Thru Trains (6 PM to 6AM) [Box #II.1.B on Form 6180.71]" | high |
| Houston crossings with 2025 train counts | 425 crossings; 3,158 day and 2,966 night through-trains (summed over crossings) | trains | [FRA] API, `cityname='HOUSTON'`, `countycode='48201'`, `trainsperyear='2025'` | API reply: `{"trainsperyear":"2025","n":"425","day":"3158","night":"2966"}` | high |
| Houston rail night share, 18:00 to 06:00 | 48.4 | % of through-train passages | [FRA] | computed: 2966 / (3158 + 2966) | medium (crossing-weighted, 12 h resolution only) |
| All 829 Houston crossings with trains, any count year | 5,028 day, 5,485 night (52.2% night) | trains | [FRA] API | API reply: `{"cityname":"HOUSTON","n":"829","day":"5028","night":"5485"}` | medium (mixed years, 300 records with no year) |
| Houston hourly rail profile | not found | - | - | - | unsourced |

## Equations

### E1. Block offset from a share of daily vehicles

Variables: `L24` = BTS 24-hour LAeq (dBA). `s_b` = share of daily vehicles in block `b`
(fraction). `h_b` = hours in block `b`. Assumes the vehicle mix and speed are the same in
every hour, so sound energy is proportional to vehicle count.

```
s_b       = sum of hourly shares over the hours in b
offset_b  = 10*log10(s_b * 24 / h_b)                 dB
L_b       = L24 + offset_b                           dBA
```

Check: `sum_b (h_b/24) * 10^(offset_b/10) = sum_b s_b = 1`, so the five blocks put back
together give `L24` exactly.

Arithmetic, freeway (Houston district, pooled):

| block | s_b | s_b * 24 / h_b | 10*log10 |
|---|---|---|---|
| `overnight` | 0.0904 | 0.0904 * 24 / 6 = 0.3618 | -4.42 |
| `morning_rush` | 0.2082 | 0.2082 * 24 / 4 = 1.2489 | +0.97 |
| `midday` | 0.3448 | 0.3448 * 24 / 6 = 1.3791 | +1.40 |
| `evening_rush` | 0.2346 | 0.2346 * 24 / 4 = 1.4077 | +1.48 |
| `evening` | 0.1220 | 0.1220 * 24 / 4 = 0.7321 | -1.35 |

Arithmetic, arterial (Texas urban, pooled):

| block | s_b | s_b * 24 / h_b | 10*log10 |
|---|---|---|---|
| `overnight` | 0.0664 | 0.0664 * 24 / 6 = 0.2658 | -5.76 |
| `morning_rush` | 0.2027 | 0.2027 * 24 / 4 = 1.2164 | +0.85 |
| `midday` | 0.3630 | 0.3630 * 24 / 6 = 1.4519 | +1.62 |
| `evening_rush` | 0.2662 | 0.2662 * 24 / 4 = 1.5972 | +2.03 |
| `evening` | 0.1017 | 0.1017 * 24 / 4 = 0.6100 | -2.15 |

Worked example: a wall next to a freeway with a BTS value of L24 = 65.0 dBA gives
`overnight` 60.6, `morning_rush` 66.0, `midday` 66.4, `evening_rush` 66.5, `evening` 63.6 dBA.
Check: `10*log10((6*10^6.06 + 4*10^6.60 + 6*10^6.64 + 4*10^6.65 + 4*10^6.36) / 24) = 65.0`.

How the shares were computed: for each station, all lanes and directions, add up each
hour's volume over every day in the four months. Pool the stations in a group by adding
their hourly totals (so busy stations weigh more), then divide by the group's daily total.
Weighting each station equally instead changes no offset by more than 0.3 dB.
No records were dropped: none had a restriction flag or a missing hour.

### E2. Night share, day/night split and DNL

Same as R1 equation E2, with `f` = share of daily vehicles between 22:00 and 07:00
(hours 22, 23, 0 to 6).

```
L_night = L24 + 10*log10(f * 24 / 9)
L_day   = L24 + 10*log10((1 - f) * 24 / 15)
DNL     = L24 + 10*log10(1 + 9*f)
```

| case | f | L_night - L24 | L_day - L24 | DNL - L24 |
|---|---|---|---|---|
| HUD default | 0.150 | -3.98 | +1.34 | +3.71 |
| Houston freeway | 0.1876 | -3.01 | +1.14 | +4.29 |
| Texas urban arterial | 0.1439 | -4.16 | +1.37 | +3.61 |

DNL from the five blocks (plan section 1.3) needs the 22:00 to 07:00 hours, which cut
across `evening` and `morning_rush`. If the model keeps only the five block levels, it should
spread each block's energy evenly over its hours. For freeways that gives a night share of
`0.1220/2 + 0.0904 + 0.2082/4 = 0.2035` instead of the true 0.1876, a DNL error of +0.2 dB.
For arterials it gives `0.1017/2 + 0.0664 + 0.2027/4 = 0.1679` against 0.1439, +0.4 dB.
Storing `f` as one more number per road class avoids this.

### E3. Truck correction (form only, factor from R7)

Variables: `p_b` = heavy-vehicle share of VMT in block `b` (Q2 table). `k` = energy of one
heavy truck divided by the energy of one car at the same speed and distance
(`k = 10^(dL/10)`, where `dL` is the truck minus car emission level from R7).

```
w_b       = s_b * (1 - p_b + k * p_b)
e_b       = w_b / sum_b w_b                     share of daily sound energy
offset_b  = 10*log10(e_b * 24 / h_b)
```

With `k = 1` this is E1. Overnight `p_b` is above the daily mean and PM peak `p_b` is below
it. So for any `k > 1` the `overnight` offset rises and `evening_rush` falls. No value of `k`
is given here (unsourced in this file). The four TTI periods do not line up with the five
blocks (AM is 07-10, overnight is 20-07), so `p_b` for `overnight` and `evening` both take the
TTI overnight value, and `morning_rush` takes the AM value.

### E4. Rail offsets from a 12-hour split

Variables: `n_d`, `n_n` = through-trains in 06:00-18:00 and 18:00-06:00. Spread each evenly
over its 12 hours.

```
r_d = n_d / (n_d + n_n) / 12         share per day hour
r_n = n_n / (n_d + n_n) / 12         share per night hour
s_b = r_d * (day hours in b) + r_n * (night hours in b)
offset_b = 10*log10(s_b * 24 / h_b)
```

Houston 2025: `r_d = 0.5157/12`, `r_n = 0.4843/12`.
`overnight` (6 night h): 0.2422, `* 4 = 0.9686`, -0.14 dB.
`morning_rush` (4 day h): 0.1719, `* 6 = 1.0314`, +0.13 dB.
`midday` (6 day h): 0.2579, `* 4 = 1.0314`, +0.13 dB.
`evening_rush` (2 day h + 2 night h): 0.1667, `* 6 = 1.000`, 0.00 dB.
`evening` (4 night h): 0.1614, `* 6 = 0.9686`, -0.14 dB.
Night share 22:00 to 07:00 = `8*r_n + 1*r_d = 0.366`, so DNL = L24 + 6.3.
Under HUD's 15% it would be L24 + 3.7.

## Conflicts

1. **HUD 15% or measured night share for freeways.** Houston freeways carry 18.8% of daily
   vehicles at night, against HUD's 15%. **Take the measured 18.8% for freeways and 14.4%
   for arterials.** It is Houston (or Texas) data, from 2025, from TxDOT's own counters. HUD's
   15% is a national screening default. It also sits inside a validity rule (51.106(a)(2))
   that Houston freeways fail. The DNL difference for freeways is 0.6 dB.
2. **Plan placeholder or this table.** The plan's simple form uses day blocks = L24 + 1.3 and
   `overnight` = L24 - 4.0. **Replace it with the five-row table.** The freeway `overnight`
   (-4.4) is close. The arterial `overnight` (-5.8) and both `evening` rows (-1.4, -2.1) are
   not, and a single "+1.3" for day blocks misses the 1 dB spread between `morning_rush` and
   `evening_rush`.
3. **All days or weekdays.** Tuesday to Thursday gives a busier `morning_rush` (+1.4 instead
   of +1.0 on freeways) and a quieter `evening`. **Take all days**, because BTS L24 is built
   from AADT (R1), which averages all seven days. Use the weekday numbers only to compare
   with weekday measurements.
4. **TTI Table 24 or TMAS.** TTI's HGB factors (all road types, summer weekday) differ from
   the TMAS all-days freeway shares by up to 0.5 dB, and match the TMAS Tuesday-to-Thursday
   freeway shares within 0.6 dB. **Take TMAS**, which splits freeways from arterials and
   covers all days. Keep TTI as the independent check.
5. **TTI period hours.** [TTI25] Table 24 puts the HGB AM peak at 06-09 and overnight at
   19-06. The footnote under Table 45 (same report) puts the HGB AM peak at 07-10 and
   overnight at 20-07. The VMT mix in Q2 is for "TxDOT District" periods and does not say
   which. This only affects which hours the Q2 truck shares belong to, not the offsets.
6. **Arterial sample.** Texas "urban" FC 14/16 stations include small-city state highways
   (McAllen, Laredo, San Angelo) as well as large-city ones. Houston has only 3. Their
   offsets are within 0.5 dB of the statewide group, so **take the statewide group**, at
   medium confidence. City streets below arterials (collectors, locals) have no TMAS stations
   here. Use the arterial row for them as a `placeholder`.
7. **Rail: HUD 15% or FRA.** HUD's 15% night share for rail (R1) does not fit Houston:
   freight trains run around the clock, with 48% of passages between 18:00 and 06:00.
   **Take the FRA split** (offsets within 0.15 dB of 0). It does not change L24, but it
   changes rail DNL from L24 + 3.7 to L24 + 6.3.

## Not found

- **Hourly Houston rail profile.** Only the FRA 12-hour split was found. Fallback: E4, flat
  within each 12 hours. The METRORail light rail timetable was not checked; it is in
  [FRA] as transit trains at only 3 Houston crossings.
- **A full year of TMAS data.** Only 4 of 12 months of 2025 were used. Fallback: the four
  months, one per season. Adding the other 8 months is a download, not new research.
- **Per-hour truck shares.** TTI gives 4 periods, not 24 hours. TMAS classification files
  (`.CLS`) have hourly counts by FHWA vehicle class but were not downloaded. Fallback: the
  TTI periods mapped as in E3.
- **The truck-to-car energy factor `k`.** Belongs to R7 (FHWA emission levels). Without it,
  E3 cannot be evaluated, and the E1 offsets stand.
- **A national FHWA default hourly profile.** The TMG has the state compute its own
  time-of-day factors. None was found in the part of TMG chapter 3 that was read.
- **Night share for aviation (IAH, HOU).** Out of scope here and still open from R1.
- **The 1196-1 report URL** fails a TLS certificate check in some clients. The PDF itself
  was read.
