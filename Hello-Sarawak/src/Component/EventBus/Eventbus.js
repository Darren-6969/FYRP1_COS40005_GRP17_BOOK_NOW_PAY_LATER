class EventBus {
    constructor() {
        this.listeners = {};
    }

    on(event, listener) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
    }

    off(event, listener) {
        if (!this.listeners[event]) return;

        this.listeners[event] = this.listeners[event].filter(l => l !== listener);
    }

    emit(event, data) {
        if (!this.listeners[event]) return;

        this.listeners[event].forEach(listener => listener(data));
    }
}

const eventBus = new EventBus();
export default eventBus;