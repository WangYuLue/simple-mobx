export default class EventEmitter {
  list = {};
  on(event, fn) {
    let target = this.list[event];
    if (!target) {
      this.list[event] = [];
      target = this.list[event];
    }
    target.push(fn);
  };
  emit(event, ...args) {
    let fns = this.list[event];
    if (fns && fns.length > 0) {
      fns.forEach(fn => {
        fn && fn(...args);
      });
    }
  }
};

