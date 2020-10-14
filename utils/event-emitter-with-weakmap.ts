export default class EventEmitter {
  list = new WeakMap();
  on(obj, event, fn) {
    let targetObj = this.list.get(obj);
    if (!targetObj) {
      targetObj = {};
      this.list.set(obj, targetObj);
    }
    let target = targetObj[event];
    if (!target) {
      targetObj[event] = [];
      target = targetObj[event];
    }
    if (!target.includes(fn)) {
      target.push(fn);
    }
  };
  emit(obj, event, ...args) {
    const targetObj = this.list.get(obj);
    if (targetObj) {
      const fns = targetObj[event];
      if (fns && fns.length > 0) {
        fns.forEach(fn => {
          fn && fn(...args);
        });
      }
    }
  }
};

