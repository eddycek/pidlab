# Blackbox Parser

Parses Betaflight .bbl/.bfl binary log files into typed time series data.

## Pipeline

StreamReader → HeaderParser → ValueDecoder → PredictorApplier → FrameParser → BlackboxParser

- 10 encoding types, 10 predictor types — validated against BF Explorer (see `docs/BBL_PARSER_VALIDATION.md`)
- Multi-session support (multiple flights per file)
- Corruption recovery aligned with BF Explorer (byte-by-byte, no forward-scan resync)

## Encoding & Predictor Details

- **NEG_14BIT encoding**: Uses `-signExtend14Bit(readUnsignedVB())` matching BF Explorer. Sign-extends bit 13, then negates.
- **TAG8_8SVB count==1**: When only 1 field uses this encoding, reads signedVB directly (no tag byte) — matches BF encoder/decoder special case.
- **AVERAGE_2 predictor**: Uses `Math.trunc((prev + prev2) / 2)` for truncation toward zero (C integer division), matching BF Explorer.

## Frame Handling

- **LOG_END handling**: `parseEventFrame()` returns event type; LOG_END validates "End of log\0" string (anti-false-positive), then terminates session. Matches BF viewer behavior.
- **Event frame parsing**: Uses VB encoding (readUnsignedVB/readSignedVB) for all event data — NOT fixed skip(). SYNC_BEEP=1×UVB, DISARM=1×UVB, FLIGHT_MODE=2×UVB, LOGGING_RESUME=2×UVB, INFLIGHT_ADJUSTMENT=1×U8+conditional.
- **Frame validation** (aligned with BF viewer): structural size limit (256 bytes), iteration continuity (< 5000 jump), time continuity (< 10s jump). No sensor value thresholds — debug/motor fields can legitimately exceed any fixed range. No consecutive corrupt frame limit (matches BF Explorer).
- **Unknown bytes**: Silently skipped at frame boundaries (0x00, 0x02, 0x04 etc. are normal). No corruption counting.
- **Corrupt frame recovery**: Rewind to `frameStart + 1` and continue byte-by-byte (matches BF Explorer). No forward-scan resync.

## IPC & Output

- IPC: `BLACKBOX_PARSE_LOG` + `EVENT_BLACKBOX_PARSE_PROGRESS`
- Output: `BlackboxFlightData` with gyro, setpoint, PID, motor as `Float64Array` time series
