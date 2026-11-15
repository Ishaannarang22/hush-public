# Field test 1: Bluetooth speaker through a hotel room's window wall

Date: Sat 2026-11-14. Tester: Alejandro. Meter: phone sound-level app, A-weighted.
Room file: `fieldtests/property.hotel.json` (location left out on purpose).

## Setup

- Room: 23 ft x 11 ft, 8 ft ceiling (23.5 m2, 57 m3). Window wall 11 ft x 8 ft with a
  6 ft x 3 ft 3 in window (22% of the wall).
- Speaker: portable Bluetooth speaker outside, about 1 ft from the window wall.
- Listener: inside, about 4 ft from the window wall.
- Room background with the speaker off: about 45 dBA.

## Assumed, not confirmed

Reverberation time 0.5 s. Speaker radiates evenly in all directions.
The predictions in the table were made assuming the speaker was aimed at the middle of
the window and the wall was brick veneer (rating 40). See below for what was confirmed.

## Confirmed after the test

The window does not open, but it is cheaply built and not fully sealed, so it leaks
about as much as a window that opens. The leak fraction used (0.01, with the 15% cap)
therefore stands. The predictions in the table used the rating of an opening
double-pane unit (23). With the rating of a fixed double-pane unit (25) and the same
leak, the drop is 29.5 dB instead of 28.7, and run 2's centre prediction becomes 55.0
instead of 55.7, against 54 measured: the model about 1 dB too loud.

The outside wall is stucco, as far as can be seen, not brick. The speaker was less than
1 ft off the centre of the window. Stucco (rating 27 to 29) raises the predicted level
by 0.2 to 0.3 dB, and being up to 1 ft off-centre lowers it by 0.1 dB. Together they
move the prediction by about +0.1 dB, to 55.0 to 55.2 against 54 measured. The wall
carries only 4% to 7% of the sound entering the room in this setup; frame leakage
carries about 65% and the glass about 30%. The results table is unchanged.

## Method

The model's built-in speaker mode assumes the wall is evenly covered. At 1 ft it is not,
so the spreading was worked out by hand and the model's wall, window, leak and room
values were used for the rest:

1. Sound power from the level 1 ft from the speaker (point source).
2. Share of that power landing on the window and on the rest of the wall, from the
   solid angle each covers as seen from the speaker (window 3.76 sr, whole wall 5.07 sr).
3. Power passed by glass, frame leakage and wall, using the model's values.
4. Level at the listener: reverberant part `4W/A` plus the direct part from the window
   at 4 ft (`W / (2*pi*r^2)`).

Result: the level at the listener is 28.7 dB below the level 1 ft from the speaker.

## Reproduce it

The hand calculation is now code, as a standalone example that the model does not import:

```
python fieldtests/near_speaker.py fieldtests/hotel_speaker_test.json
pytest fieldtests
```

`hotel_speaker_test.json` holds the measurements and two setups: `as_predicted` (what was
assumed when the predictions were given) and `confirmed` (what was confirmed by eye
afterwards). The script reads the wall, window, leak and room values from
`assumptions.yaml`, so they are the same ones the model uses. The window is assumed to be
centred in the wall; its position was not measured.

## Results

| Run | Speaker at 1 ft | Predicted at listener (with background) | Measured | Blind? |
|---|---|---|---|---|
| 1 | 79 dBA | about 51.4 (speaker alone 50.3) | 50 to 53 | No. The near-wall step was added after the reading; the mid-room figure of 48 was given before |
| 2 | 82 to 86 dBA | 53.9 to 57.5, centre 55.7 | 52 to 56, centre 54 | Yes. Prediction given before the reading |

Background removed, speaker alone: run 1 measured 48.3 to 52.3 against 50.3 predicted;
run 2 measured 51.0 to 55.6 against 53.3 to 57.3 predicted.

Difference at the centre of each range: run 1 about 0 dB, run 2 the model about 2 dB
too loud. Both are inside the model's stated range of plus or minus 3 dB.

## Limits of this test

- Signal was 5 to 11 dB above the background. Run 1 was under the 10 dB margin.
- Readings moved by about plus or minus 2 dB on both sides.
- One room, one wall, one listener position.
- Wall type, window type and speaker aim were confirmed by eye after the test, not
  measured.
- It tests the wall-and-window step and the room step. It does not test how the model
  gets from traffic to the level at the wall.
