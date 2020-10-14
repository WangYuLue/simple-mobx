import EventEmitter from '../utils/event-emitter-with-weakmap';

const em = new EventEmitter();
let currentFn;

const autorun = (fn) => {
  const warpFn = () => {
    currentFn = warpFn;
    fn();
    currentFn = null;
  }
  warpFn();
};

const observable = (obj) => {
  // 用 Symbol 当 key；这样就不会被枚举到，仅用于值的存储
  const data = Symbol('data');
  obj[data] = JSON.parse(JSON.stringify(obj));

  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'object') {
      observable(obj[key]);
    } else {
      Object.defineProperty(obj, key, {
        get: function () {
          if (currentFn) {
            em.on(obj, key, currentFn);
          }
          return obj[data][key];
        },
        set: function (v) {
          // 值不变时不触发
          if (obj[data][key] !== v) {
            obj[data][key] = v;
            em.emit(obj, key);
          }
        }
      });
    }
  });
  return obj;
};

export {
  autorun,
  observable
}