# @vitorsreis/masterslave

Lightweight browser library for cross-tab leader election and event broadcasting.

## Why use it

- Single-master coordination per browser tab group
- Simple event API for cross-tab communication
- No framework dependency
- Works in modern browsers with graceful fallback

## Quick start

```html
<!-- <script src="https://cdn.jsdelivr.net/npm/@vitorsreis/masterslave"></script> -->
<!-- <script src="https://unpkg.com/@vitorsreis/masterslave"></script> -->

<script src="masterslave.js"></script>
<script>
    const instance = MasterSlave(
        "my-app-tabs",
        (data) => {
             /* onEvent */
             console.log("event from another tab:", data);
        },
        () => {
            /* onMaster */
            console.log("this tab is now master");

            // Example: master sends a heartbeat event
            setInterval(() => {
                instance.emit({type: "heartbeat", at: Date.now()});
            }, 3000);
        }
    );

    console.log("tab id:", instance.id);
    console.log("is master:", instance.isMaster());

    // Emit a custom event
    // instance.emit({ type: "ping" });

    // Stop and cleanup
    // instance.close();
</script>
```

## API reference

### `MasterSlave(identifier, onEvent, onMaster?)`

Creates and starts a tab coordination instance.

**Parameters**

- `identifier` (`string`): group id. Tabs using the same id compete for master ownership.
- `onEvent` (`(data: any) => void`): called when an event is received from another tab.
- `onMaster` (`(emit: (data: any) => void) => void`, optional): called once when the current tab becomes master.

**Returns**

- `id` (`string`): unique id of the current tab instance.
- `isMaster()` (`() => boolean`): whether the current tab owns the master role.
- `emit(data)` (`(data: any) => void`): broadcasts an event to tabs in the same `identifier` group.
- `close()` (`() => void`): removes listeners, intervals and ownership state.

## How it works

- Master election state is shared through `localStorage`.
- Liveness is maintained via periodic heartbeat keys.
- Events are delivered with `BroadcastChannel` when available.
- If `BroadcastChannel` is unavailable, events use `localStorage` storage events.

## Compatibility

- Browser environment with `window` and `localStorage`
- `BroadcastChannel` optional (auto-detected)

## Contributing

Contributions are welcome. Please open an issue to discuss bug reports, API changes, or feature requests before sending
a pull request.

## License

MIT. See `LICENSE`.