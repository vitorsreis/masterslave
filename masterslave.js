/*!
 * MasterSlave JavaScript Library v1.0.5
 * (c) 2026-present Vitor Reis and contributors
 *
 * https://github.com/vitorsreis/masterslave
 */

(function (global, factory) {
    "use strict";

    if (typeof module === "object" && typeof module.exports === "object") {
        module.exports = global.document
            ? factory(global, true)
            : function (w) {
                if (!w || !w.document) {
                    throw new Error("MasterSlave requires a window with a document");
                }
                return factory(w, true);
            };
    } else {
        factory(global);
    }
})(typeof window !== "undefined" ? window : globalThis, function (window, noGlobal) {
    "use strict";

    if (!window) {
        throw new Error("MasterSlave requires a browser-like window");
    }

    /**
     * @template {string} Identifier
     * @template {(data:any)=>void} EmitFunction
     * @template {(data:any)=>void} OnEventHandler
     * @template {()=>void|undefined} OnMasterHandler
     * @template {()=>boolean} IsMasterFunction
     * @template {()=>void} CloseFunction
     * @template {{
     *     id: Identifier,
     *     isMaster: IsMasterFunction,
     *     emit: EmitFunction,
     *     close: CloseFunction
     * }} MasterSlaveInstance
     *
     * @param {Identifier} identifier A unique string to identify the master-slave group. Tabs with the same identifier will compete for master role and receive events.
     * @param {OnEventHandler} onEvent A callback function that will be called when an event is received from another tab. It receives the event data as argument.
     * @param {OnMasterHandler} onMaster A callback function that will be called when the tab becomes master. It receives an emit function as argument to send events to other tabs.
     * @returns {MasterSlaveInstance} An object with the tab identifier, a function to check if the tab is master, and a function to clean up resources.
     */
    const MasterSlave = function (identifier, onEvent, onMaster = undefined) {
        if (!identifier) throw new Error("identifier required");
        if (typeof onEvent !== "function") throw new Error("onEvent must be a function");

        const now = () => Date.now();
        const uniqid = () => {
            return window.crypto && typeof window.crypto.randomUUID === "function"
                ? window.crypto.randomUUID()
                : Math.random().toString(36).slice(2);
        }
        const safeParse = (value) => {
            try {
                return JSON.parse(value);
            } catch {
                return null;
            }
        }
        const storage = {
            get: (k) => localStorage.getItem(k),
            set: (k, v) => localStorage.setItem(k, v),
            del: (k) => localStorage.removeItem(k)
        }

        const tab_id = `${identifier}:${uniqid()}`;
        const master_key = `${identifier}:master`;
        const heartbeat_key = `${tab_id}:heartbeat`;
        const event_prefix = `${identifier}:event`;

        let heartbeatInterval = null;
        let electionInterval = null;
        let masterStarted = false;
        let closed = false;

        const HEARTBEAT_INTERVAL = 5_000;
        const MASTER_TTL = 10_000;

        const broadcastInstance = typeof BroadcastChannel !== "undefined"
            ? new BroadcastChannel(identifier)
            : null;

        const heartbeat = () => storage.set(heartbeat_key, now().toString());
        const startHeartbeat = () => {
            heartbeat();
            clearInterval(heartbeatInterval);
            heartbeatInterval = setInterval(heartbeat, HEARTBEAT_INTERVAL);
        }
        const stopHeartbeat = () => {
            clearInterval(heartbeatInterval);
            storage.del(heartbeat_key);
        }

        const getMaster = () => {
            const raw = storage.get(master_key);
            if (!raw) return null;

            const data = safeParse(raw);
            if (!data?.id) return null;

            const beat = Number(storage.get(`${data.id}:heartbeat`));
            if (!beat || now() - beat > MASTER_TTL) {
                storage.del(master_key);
                storage.del(`${data.id}:heartbeat`);
                return null;
            }

            return data.id;
        }
        const isMaster = () => getMaster() === tab_id;
        const tryBecomeMaster = () => {
            const current = getMaster();
            if (current && current !== tab_id) return false;

            storage.set(master_key, JSON.stringify({id: tab_id, ts: now()}));
            heartbeat();

            setTimeout(() => {
                if (isMaster() && !masterStarted) {
                    masterStarted = true;
                    startHeartbeat();
                    if (onMaster) onMaster();
                } else if (!masterStarted) {
                    stopHeartbeat()
                }
            }, 50)

            return isMaster();
        }

        const emit = (data) => {
            const payload = {sender: tab_id, data, ts: now()};

            if (broadcastInstance) {
                broadcastInstance.postMessage(payload);
            } else {
                const event_key = `${event_prefix}:${uniqid()}`;
                storage.set(event_key, JSON.stringify(payload));
                setTimeout(() => storage.del(event_key), 100);
            }

            onEvent(data);
        }
        const handleEvent = (payload) => {
            if (!payload) return;
            if (payload.sender === tab_id) return;
            onEvent(payload.data);
        }

        const storageListener = (event) => {
            if (!event.key) return;

            if (event.key === master_key && !event.newValue) {
                tryBecomeMaster();
            }

            if (!broadcastInstance && event.key.startsWith(event_prefix) && event.newValue) {
                handleEvent(safeParse(event.newValue));
            }
        }
        const broadcastListener = (event) => handleEvent(event.data);
        window.addEventListener("storage", storageListener);
        if (broadcastInstance) broadcastInstance.addEventListener("message", broadcastListener);

        electionInterval = setInterval(() => {
            // Failsafe in case a tab misses the master deletion event
            if (tryBecomeMaster()) clearInterval(electionInterval);
        }, 5_000)

        const close = () => {
            if (closed) return;
            closed = true;

            clearInterval(electionInterval);

            window.removeEventListener("storage", storageListener);
            window.removeEventListener("beforeunload", close);
            window.removeEventListener("pagehide", close);

            if (broadcastInstance) {
                broadcastInstance.removeEventListener("message", broadcastListener);
                broadcastInstance.close();
            }

            if (isMaster()) storage.del(master_key);
            stopHeartbeat();
        }
        window.addEventListener("beforeunload", close);
        window.addEventListener("pagehide", close);

        tryBecomeMaster();

        return {
            id: tab_id,
            isMaster,
            emit,
            close
        }
    };

    if (!noGlobal) {
        window.MasterSlave = MasterSlave;
    }

    return MasterSlave;
});