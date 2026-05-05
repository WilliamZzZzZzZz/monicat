# Action System

MochiCat uses a unified action state machine introduced in Phase 14. All state transitions go through a single `dispatchPetAction` function backed by `usePetActionController`.

---

## PetState

```ts
type PetState =
  | 'idle'
  | 'dragging'
  | 'happy'
  | 'sleeping'
  | 'walk_right'
  | 'walk_left'
  | 'grooming';
```

---

## ActionKind

Each state has a `kind` that determines dispatch priority rules:

| Kind | Description | Example States |
|------|-------------|---------------|
| `persistent` | Stays until explicitly replaced | `idle`, `sleeping` |
| `oneShot` | Auto-returns to `returnState` after `defaultDurationMs` | `happy`, `grooming` |
| `locomotion` | RAF-driven movement; ends on boundary or duration | `walk_right`, `walk_left` |
| `interactionOverride` | Entered only via pointer interaction; blocks all other sources | `dragging` |

---

## Action Registry (`src/actions/actionRegistry.ts`)

`PET_ACTIONS` is a `Record<PetState, PetActionDefinition>` that centralises:

- `kind` — see above
- `defaultDurationMs` — for oneShot states
- `returnState` — where to return after oneShot completes
- `canBeTriggeredRandomly` — whether random behavior may dispatch this state
- `blocksRandomBehavior` — whether random behavior is suppressed while in this state
- `resetsInactivityTimerOnStart` — whether entering this state reschedules the sleep timer
- `defaultBubble` — default speech bubble text

---

## Dispatch Rules (`usePetActionController`)

```
Source: dragging
  Only accepts drag lifecycle actions (interaction → dragging, interaction → idle)
  All other requests are rejected

Source: random
  Rejected if manualActionCooldownUntil has not expired
  Rejected if current state's kind is oneShot / locomotion / interactionOverride
  Rejected if action.canBeTriggeredRandomly === false

Source: system (walking completed)
  Only accepted if current kind is locomotion (prevents stale callbacks)

Source: menu / manual / tray / interaction
  Accepted from any state except dragging
  Marks user interaction, sets manualActionCooldownUntilRef
```

### Action Token (Stale Timer Protection)

Every transition increments `actionTokenRef`. oneShot and inactivity timers capture the token at scheduling time. When a timer fires, it compares its captured token against the current token:

- If tokens differ → the state changed since the timer was set → **timer is ignored**
- If tokens match AND current state matches `expectedState` → timer fires normally

This prevents, for example, a `happy` timer from returning to `idle` after `walk_right` was dispatched.

---

## Inactivity Timer (Sleep)

- Scheduled whenever the pet enters `idle` (if `sleepAfterIdleMs` is non-null)
- Fires `dispatchPetAction({ state: 'sleeping', source: 'timer' })`
- Protected by action token — will not fire if state has changed
- Disabled when `sleepAfterIdleMs === null`

---

## How to Add a New oneShot Action (e.g., `stretching`)

1. Add `'stretching'` to `PetState` in `src/types/pet.ts`.
2. Add frames in `src/animation/animationConfig.ts`.
3. Add the asset directory `src/assets/cat/stretching/`.
4. Add to `PET_ACTIONS` in `src/actions/actionRegistry.ts`:

```ts
stretching: {
  state: 'stretching',
  kind: 'oneShot',
  defaultDurationMs: 2_000,
  returnState: 'idle',
  canBeTriggeredRandomly: true,
  blocksRandomBehavior: true,
  resetsInactivityTimerOnStart: true,
},
```

5. Wire a menu item in `src/App.tsx` `handleMenuAction`.
6. Add `PET_STATE_EMOJI` entry.
7. Add to `validate_runtime_assets.py` `ANIMATION_STATES`.
8. Add tests in `src/actions/actionRegistry.test.ts`.

---

## How to Add a New locomotion Action

Similar to oneShot but:
- `kind: 'locomotion'`
- No `defaultDurationMs` or `returnState`
- Movement is driven by `useWalkingMovement` or a new dedicated hook
- Completion dispatched via `source: 'system', reason: 'walking completed'`
