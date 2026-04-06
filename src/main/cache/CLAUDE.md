# FC State Cache (`src/main/cache/`)

Centralized in-memory cache for all MSP-readable FC state. Eliminates race conditions from independent MSP reads across multiple IPC handlers and UI components.

## FCStateCache Class

**File:** `FCStateCache.ts` (~370 lines)

Extends `EventEmitter`. Constructed with a `CacheMSPClient` (satisfied by both `MSPClient` and `MockMSPClient`). Late-bound dependencies via `setDependencies(snapshotProvider, profileProvider)` for blackbox settings reading.

### API

| Method | Description |
|--------|-------------|
| `hydrate()` | Full population from FC — reads all MSP data + BB settings from snapshot |
| `invalidate(slices)` | Re-read specific slices from FC (skips if CLI mode active) |
| `clear()` | Reset all state to null (called on disconnect) |
| `getState()` | Frozen copy of full `FCState` |
| `getSlice(key)` | Single slice value |
| `setDependencies(snap, profile)` | Set snapshot/profile providers for BB settings |

Emits `'state-changed'` with frozen `FCState` on every mutation. `index.ts` forwards this to the renderer via `sendFCStateChanged()`.

### Hydration Sequence

Called once after baseline creation + smart reconnect completes:

```
1. getFCInfo()                    → info           (must be first — apiVersion needed)
2. getStatusEx(apiVersion)        → statusEx       (PID profile index)
3. Promise.all([                                   (parallel — different MSP commands)
     getPIDConfiguration(),       → pidConfig
     getFilterConfiguration(),    → filterConfig
     getRatesConfiguration(),     → ratesConfig
     getBlackboxInfo(),           → blackboxInfo
   ])
4. getFeedforwardConfiguration()  → feedforwardConfig  (SEQUENTIAL — MSP_PID_ADVANCED)
5. getTuningConfig()              → tuningConfig       (SEQUENTIAL — MSP_PID_ADVANCED)
6. readBlackboxSettings()         → blackboxSettings   (from baseline snapshot CLI diff)
```

Steps 4-5 are sequential because both read MSP command 94 (MSP_PID_ADVANCED) and the response queue is keyed by command ID.

### Invalidation Matrix

| Mutation | Invalidated Slices | Trigger |
|----------|-------------------|---------|
| Connect / reconnect | ALL | `hydrate()` |
| Disconnect | ALL | `clear()` |
| Erase flash | `blackboxInfo` | `invalidate(['blackboxInfo'])` |
| Download BB log | `blackboxInfo` | `invalidate(['blackboxInfo'])` |
| PID profile switch | `pidConfig`, `filterConfig`, `feedforwardConfig`, `ratesConfig`, `tuningConfig`, `statusEx` | `invalidate([...])` |
| Apply / restore / fix (reboot) | ALL | Auto via reconnect → `hydrate()` |

### Guards

1. **CLI mode guard**: `invalidate()` checks `mspClient.isInCLI()` — skips MSP reads when FC is in CLI mode (prevents timeout race conditions during CLI export or snapshot restore).

2. **Flash-to-none guard**: After erase, MSP may transiently return `storageType='none'` before dataflash reinitializes. If the previous `storageType` was `'flash'` and new is `'none'`, preserves `storageType='flash'` and zeroes out sizes. Applied in both `hydrate()` and `invalidate()`.

3. **Generation counter**: `hydrateGeneration` incremented on `hydrate()` and `clear()`. Each async phase checks the counter before writing results — stale hydrations from a previous connection are silently discarded.

### Integration Points

- **`src/main/index.ts`**: Creates `FCStateCache`, wires `'state-changed'` event to `sendFCStateChanged()`, calls `hydrate()` after connect + baseline, calls `clear()` on disconnect.
- **`src/main/ipc/handlers/index.ts`**: Registers `FC_GET_STATE` handler (returns `cache.getState()`).
- **`src/main/ipc/handlers/types.ts`**: `HandlerDependencies.fcStateCache` — injected into all handler modules.
- **IPC handlers** (`blackboxHandlers`, `fcInfoHandlers`, `pidHandlers`): Read from cache with MSP fallback, call `invalidate()` after mutations.
- **`src/main/storage/SnapshotManager.ts`**: Reads MSP config from cache instead of 4 MSP calls during `createSnapshot()`.

### Renderer Side

- **`src/renderer/hooks/useFCState.ts`**: Single hook providing all FC data. Subscribes to `onFCStateChanged` (push), fetches initial state via `getFCState()` (pull). Race-safe: live updates take priority over initial fetch.
- **`src/preload/index.ts`**: Bridges `getFCState()` and `onFCStateChanged()` to renderer.
- **`src/shared/types/fcState.types.ts`**: `FCState` interface, `FCStateSlice` type, `EMPTY_FC_STATE` constant.

### State Shape

```typescript
interface FCState {
  info: FCInfo | null;
  statusEx: { pidProfileIndex: number; pidProfileCount: number } | null;
  pidConfig: PIDConfiguration | null;
  filterConfig: CurrentFilterSettings | null;
  feedforwardConfig: FeedforwardConfiguration | null;
  ratesConfig: RatesConfiguration | null;
  tuningConfig: Record<string, number> | null;
  blackboxInfo: BlackboxInfo | null;
  blackboxSettings: BlackboxSettings | null;  // CLI-only: from baseline snapshot
  hydratedAt: string | null;
  hydrating: boolean;
}
```

### Testing

- `FCStateCache.test.ts` — 17 tests covering hydrate, invalidate, clear, guards, generation counter, event emission
- `useFCState.test.ts` — 6 tests covering mount, push updates, cleanup
