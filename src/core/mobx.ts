import EventEmitter from './event-emitter'
const eventEmitter = new EventEmitter();

let pending = null;
let obIdNum = 1;

const autorun = (fn) => {
  pending = fn;
  fn();
  pending = null;
};

const observable = (obj) => {
  // 这个 _data 不可枚举，仅用于进行值的存储
  Object.defineProperty(obj, '_data', {
    enumerable: false,
    value: JSON.parse(JSON.stringify(obj)),
  });

  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'object') {
      observable(obj[key]);
    } else {
      const id = String(obIdNum++);
      Object.defineProperty(obj, key, {
        get: function () {
          if (pending) {
            eventEmitter.on(id, pending);
          }
          return this._data[key];
        },
        set: function (v) {
          // 值不变时不触发
          if (this._data[key] !== v) {
            this._data[key] = v;
            eventEmitter.emit(id);
          }
        }
      });
    }
  });

  return obj;
}

export {
  autorun,
  observable
}