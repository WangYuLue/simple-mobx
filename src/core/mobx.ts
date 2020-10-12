import EventEmitter from './event-emitter'
const eventEmitter = new EventEmitter();

let pending: any = null;
let obId = 1;

const autorun = (fn) => {
  const warpFn = () => {
    pending = warpFn;
    fn();
    pending = null;
  }
  warpFn();
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
      const id = String(obId++);
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


const map = new WeakMap();

const observable1 = (obj) => {
  return new Proxy(obj, {
    get: (target, propKey) => {
      if (typeof target[propKey] === 'object') {
        return observable(target[propKey])
      } else {
        if (pending) {
          if (!map.get(target)) {
            map.set(target, {});
          }
          const mapObj = map.get(target);
          const id = String(obId++);
          mapObj[propKey] = id;
          eventEmitter.on(id, pending);
        }
        return target[propKey]
      }
    },
    set: (target, propKey, value) => {
      if (target[propKey] !== value) {
        target[propKey] = value;
        const mapObj = map.get(target);
        if (mapObj && mapObj[propKey]) {
          eventEmitter.emit(mapObj[propKey]);
        }
      }
      return true;
    }
  })
}

export {
  autorun,
  observable
}