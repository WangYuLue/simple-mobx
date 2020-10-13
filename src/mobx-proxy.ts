import EventEmitter from '../utils/event-emitter';

const em = new EventEmitter();
let currentFn;
let obId = 1;

const autorun = (fn) => {
  const warpFn = () => {
    currentFn = warpFn;
    fn();
    currentFn = null;
  }
  warpFn();
};

const map = new WeakMap();

const observable = (obj) => {
  return new Proxy(obj, {
    get: (target, propKey) => {
      if (typeof target[propKey] === 'object') {
        return observable(target[propKey]);
      } else {
        if (currentFn) {
          if (!map.get(target)) {
            map.set(target, {});
          }
          const mapObj = map.get(target);
          const id = String(obId++);
          mapObj[propKey] = id;
          em.on(id, currentFn);
        }
        return target[propKey];
      }
    },
    set: (target, propKey, value) => {
      if (target[propKey] !== value) {
        target[propKey] = value;
        const mapObj = map.get(target);
        if (mapObj && mapObj[propKey]) {
          em.emit(mapObj[propKey]);
        }
      }
      return true;
    }
  });
};

export {
  autorun,
  observable
}