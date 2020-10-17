# 实现一个简单的 MobX

## 导读

Mobx 是 React 常用的状态管理库。

但是初次读 Mobx 的官方文档，概念很多，例如：`Actions`、`Derivations`、`State`，还有各种各样相关的装饰器，让人摸不着头脑。

官网提供的[例子](https://mobx.js.org/README.html)是这样的：

```ts
import React from "react"
import ReactDOM from "react-dom"
import { makeAutoObservable } from "mobx"
import { observer } from "mobx-react"

// Model the application state.
class Timer {
  secondsPassed = 0
  constructor() {
    makeAutoObservable(this)
  }
  increase() {
    this.secondsPassed += 1
  }
  reset() {
    this.secondsPassed = 0
  }
}
const myTimer = new Timer()

const TimerView = observer(({ timer }) => (
  <button onClick={() => timer.reset()}>Seconds passed: {timer.secondsPassed}</button>
))

ReactDOM.render(<TimerView timer={myTimer} />, document.body)

setInterval(() => {
  myTimer.increase()
}, 1000)
```

这个例子中，在 `Timer` 类中使用了 `makeAutoObservable` 方法使 `myTimer` 变成一个可观察对象。并且在 `TimerView` 外曾包了一个 `observer` 方法，来监听用到的可观察对象。

于是，在定时器中改变 `myTimer` 中的值时，`TimerView` 可以自动的渲染更新。

这不是一个好的例子，因为 `MobX` 是框架无关的，并不一定需要和 `React` 绑定使用。

为了体现出 Mobx 的精妙，我们需要拨开层层迷雾，来看一个更底层的例子：

```ts
import { observable, autorun } from 'mobx';

const store = observable({a: 1,b: 2});

autorun(() => {
  console.log(store.a);
});

store.a = 5;
```

运行结果为：

```bash
1
5
```

这里的精妙之处在于：**为什么在给 `store.a` 赋值时，可以自动执行 `autorun` 中的方法？**

而且 `mobx` 还很聪明，只会在自己用到的值变化时才更新。参考下面这个例子：

```ts
import { observable, autorun } from 'mobx';

const store = observable({a: 1,b: 2});

autorun(() => {
  console.log(store.a);
});

store.a = 5; // 赋值后更新 autorun 的中的方法
store.b = 10; // 由于 autorun 的中的方法没有用到 store.b，所以赋值后没有更新
```

运行结果为：

```bash
1
5
```

这样的好处是，**开发者完全不需要去控制更新范围的粒度，聪明的 `Mobx` 都帮我们做好了。**

另外，`Mobx` 还支持嵌套观察，参考下面的例子：

```ts
import { observable, autorun } from 'mobx';

const store = observable({ a: 1, b: { c: 2 } });

autorun(() => {
  console.log(store.b.c);
});

store.b.c = 10;
```

运行结果为：

```bash
2
10
```

这里我们可以把 `autorun` 方法看作第一个例子中的 `observer` 方法，可观察对象变化后，做出相应的改变。

这里的核心是`observable`、`autorun` 这两个方法，吃透它们，我们就能了解 `Mobx` 的核心原理。

这就引出来这篇文章的的目的：**实现一个简单的 MobX**

## 如何实现？

为了保证阅读效果，建议读者边阅读边动手实操，点击[这里](https://github.com/WangYuLue/simple-mobx)可以下载源码。

为了方便读者更好的阅读体验，笔者将循序渐进的分多个demo来实现一个可用的 MobX。

### 1、Mobx 与 订阅发布模式 对比

仔细观察刚才的例子：

```js
import { observable, autorun } from 'mobx';

const store = observable({a: 1,b: 2});

autorun(() => {
  console.log(store.a);
});

store.a = 5;
```

它有些像订阅发布模式：

```js
const em = new EventEmitter();

const store = {a: 1,b: 2};

// autorun
em.on('store.a', () => console.log(store.a));

// set value
store.a = 5;
em.emit('store.a');
```

只不过 `Mobx` 是在 `autorun` 中自动地进行订阅，然后在赋值时自动地触发订阅，并没有进行显式的调用。

有了这个思路，我们的 `Mobx` 底层可以用 `EventEmitter` 来实现。

所以，在这之前，我们先实现一个简单的 `EventEmitter`，参考 `utils/event-emitter.ts`：

```ts
export default class EventEmitter {
  list = {};
  on(event, fn) {
    let target = this.list[event];
    if (!target) {
      this.list[event] = [];
      target = this.list[event];
    }
    if (!target.includes(fn)) {
      target.push(fn);
    }
  };
  emit(event, ...args) {
    const fns = this.list[event];
    if (fns && fns.length > 0) {
      fns.forEach(fn => {
        fn && fn(...args);
      });
    }
  }
};
```

### 2、使用 `defineProperty` 隐式调用订阅发布

`defineProperty` 可以在对象赋值或者取值的时候添加额外的逻辑，所以我们可以用 `defineProperty` 来隐藏 `on`、`emit` 等方法的调用。

查看下面的代码：

```ts
import EventEmitter from '../utils/event-emitter'
const em = new EventEmitter();

const store = { a: 1, b: 2 };

// autorun
const fn = () => console.log(store.a)

// observable
Object.defineProperty(store, 'a', {
  get: function () {
    em.on('store.a', fn);
    return 100;
  },
  set: function () {
    em.emit('store.a');
  },
});

// 收集依赖
fn();

// set state
store.a = 2
```

上面的代码中，我们将 `on` 和 `emit` 方法封装进了 `defineProperty` 中，外部没有暴露过多的细节，这已经有了一些 Mobx 的味道。

在下面我们会做进一步的封装，只对外暴露 `observable` 和 `autorun` 方法。

### 3、实现 `observable` 和 `autorun` 方法

实现 `observable` 和 `autorun` 方法时，需要注意以下三点：

1. 设置一个内部key将当前对象的原始值储存起来，而不像上面例子中 `store.a` 永远返回 100。

1. 订阅发布的信道有可能会重复，所以需要一个机制来确保每一个对象的 key 都有唯一的信道。

1. 只在 autorun 时进行进行订阅操作。

有了上面的这些注意点，我们可以设计出第一版的 `mobx`，参考 `demo01/mobx.ts`：

```ts
import EventEmitter from '../utils/event-emitter';

const em = new EventEmitter();
let currentFn;
let obId = 1;

const autorun = (fn) => {
  currentFn = fn;
  fn();
  currentFn = null;
};

const observable = (obj) => {
  // 用 Symbol 当 key；这样就不会被枚举到，仅用于值的存储；
  const data = Symbol('data');
  obj[data] = JSON.parse(JSON.stringify(obj));

  Object.keys(obj).forEach(key => {
    // 每个 key 都生成唯一的 channel ID
    const id = String(obId++);
    Object.defineProperty(obj, key, {
      get: function () {
        if (currentFn) {
          em.on(id, currentFn);
        }
        return this[data][key];
      },
      set: function (v) {
        // 值不变时不触发
        if (this[data][key] !== v) {
          this[data][key] = v;
          em.emit(id);
        }
      }
    });
  });
  return obj;
};
```

尝试运行如下代码，参考 `demo01/index.ts`：

```ts
import { observable, autorun } from './mobx';

const store = observable({ a: 1, b: 2 });

autorun(() => {
  console.log(store.a);
});

store.a = 5;
store.a = 6;
```

结果为：
  
```bash
1
5
6
```

我们发现运行结果和使用原生的 `observable`、`autorun` 运行结果一致。

> 感兴趣的同学可以运行 `yarn demo01` 查看运行效果

### 4、支持嵌套

上面实现的 `observable` 还有一些问题，不支持嵌套观察。

例如下面的代码：

```ts
import { observable, autorun } from './mobx';

const store = observable({ a: 1, b: { c: 1 } });

autorun(() => {
  console.log(store.b.c);
});

store.b.c = 5;
store.b.c = 6;
```

赋值时并没有触发 `autorun` 中的方法。

所以基于 `demo01` 做了如下的优化，来支持嵌套。

```diff
import EventEmitter from '../utils/event-emitter';

const em = new EventEmitter();
let currentFn;
let obId = 1;

const autorun = (fn) => {
  currentFn = fn;
  fn();
  currentFn = null;
};

const observable = (obj) => {
  // 用 Symbol 当 key；这样就不会被枚举到，仅用于值的存储；
  const data = Symbol('data');
  obj[data] = JSON.parse(JSON.stringify(obj));

  Object.keys(obj).forEach(key => {
+   if (typeof obj[key] === 'object') {
+     observable(obj[key]);
+   } else {
      // 每个 key 都生成唯一的 channel ID
      const id = String(obId++);
      Object.defineProperty(obj, key, {
        get: function () {
          if (currentFn) {
            em.on(id, currentFn);
          }
          return obj[data][key];
        },
        set: function (v) {
          // 值不变时不触发
          if (obj[data][key] !== v) {
            obj[data][key] = v;
            em.emit(id);
          }
        }
      });
+   }
  });
  return obj;
};
```

> 感兴趣的同学可以运行 `yarn demo02` 查看运行效果

### 5、对依赖收集的优化

支持支持嵌套观察的 `observable` 还有一个严重的 bug。参考下面的场景：

```ts
import { observable, autorun } from './mobx';

const store = observable({ a: 1, b: { c: 1 } });

autorun(() => {
  if (store.a === 2) {
    console.log(store.b.c);
  }
});

store.a = 2
store.b.c = 5;
store.b.c = 6;
```

我们在 `demo02` 中的实现的 `mobx` 打印结果是：

```bash
1
```

而引用原生的 `mobx` 的打印结果是：

```bash
1
5
6
```

这是为什么？

注意上面代码中 `autorun` 里的方法，它里面有一个条件判断语句。在第一次 `autorun` 做依赖收集时，条件语句不成立，导致 `store.b.c` 的依赖没有收集上。

以至于后面条件语句即使成立了，也没法对 `store.b.c` 的改变作出响应。

为了修复这个问题，需要改变依赖收集的策略。之前的策略是：只在 `autorun` 时做依赖收集。

而实际上 **在 `autorun` 以及对可观察对象的值修改时都要需要做依赖收集**。

那怎么该？其实也很简单，基于 `demo03` ,我们做了如下的优化，来支持条件判断中的依赖收集。

参考下面的代码：

```diff
import EventEmitter from '../utils/event-emitter';

const em = new EventEmitter();
let currentFn;
let obId = 1;

+ const autorun = (fn) => {
+   const warpFn = () => {
+     currentFn = warpFn;
+     fn();
+     currentFn = null;
+   }
+   warpFn();
+ };

- const autorun = (fn) => {
-   currentFn = fn;
-   fn();
-   currentFn = null;
- };

const observable = (obj) => {
  // 用 Symbol 当 key；这样就不会被枚举到，仅用于值的存储
  const data = Symbol('data');
  obj[data] = JSON.parse(JSON.stringify(obj));

  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'object') {
      observable(obj[key]);
    } else {
      // 每个 key 都生成唯一的 channel ID
      const id = String(obId++);
      Object.defineProperty(obj, key, {
        get: function () {
          if (currentFn) {
            em.on(id, currentFn);
          }
          return obj[data][key];
        },
        set: function (v) {
          // 值不变时不触发
          if (obj[data][key] !== v) {
            obj[data][key] = v;
            em.emit(id);
          }
        }
      });
    }
  });
  return obj;
};
```

上面的修改本质上是对 `autorun` 中的方法做一层封装，每次触发该方法时，都可以自动的收集依赖。

> 感兴趣的同学可以运行 `yarn demo03` 查看运行效果

### 6、Proxy 版的实现（扩展阅读）

前面的 `Mobx` 是基于 `defineProperty` 来实现的。

这一小节，我们将基于 ES6 中 `Proxy` 来实现一个简易的 `Mobx`;

在这之前，先简单对比一下 `defineProperty` 与 `Proxy` 各自的基础写法：

```js
// defineProperty
Object.keys(obj).forEach(key => {
  // 每个 key 都生成唯一的 channel ID
  const id = String(obId++);
  Object.defineProperty(obj, key, {
    get: function () {
      em.on(id, fn);
      return 100;
    },
    set: function (v) {
      em.emit(id);
    }
  });
});

// Proxy
new Proxy(obj, {
  get: (target, propKey) => {
    em.on(channelId, fn);
    return target[propKey];
  },
  set: (target, propKey, value) => {
    em.emit(channelId);
  }
});
```

可以看到，使用 `defineProperty` 时，我们在定义时就能为可观察对象的所有的 key 都确定好唯一的信道。从而准确地收集依赖。

而这一点在 `Proxy` 中无法做到。我们需要一个机制来确定每个 key 都有唯一的信道。

聪明的读者可能会想到，我们可以用当前的 key 表来确定唯一的信道，类似这样：

```js
new Proxy(obj, {
  get: (target, propKey) => {
    em.on(propKey, fn);
    return target[propKey];
  },
  set: (target, propKey, value) => {
    em.emit(propKey);
  }
});
```

但是这有它的局限性，一旦遇到相同的key，就会出现bug。

聪明的读者可能又会想到，我们可以在外部维护一个 map 列表，用于记录信道，这个 map 的 key 就是需要记录的对象。

类似这样：

```js
const store = observable({ a: 5, b: 10 });

// 上面的代码执行后 map 中的数据如下：
// {
//   '[store object]':{
//     a: 'channel-1'
//     b: 'channel-2'
//   }
// }
```

但是这里有一个技术难题：**把目标对象当作key赋给普通对象时，目标对象会被隐式转换为字符串**

参考下面的代码：

```js
const map = {};
const key = {};
map[key] = "hello";
console.log(map);
// out:
// {
//  "[object Object]": "1"
// }
```

这就引出了解决这个问题的救星：`WeakMap`。查看相关的 [MDN文档](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)，我们了解到 `WeakMap` 的 key 必须是对象，而值可以是任意的。

太棒了，刚好符合上面的需求。

有了上面的思路，我们就能轻松写出 `Proxy` 版 的 `Mobx` 代码：

```ts
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
```

运行的效果和 `defineProperty` 版的完全一致。

> 感兴趣的同学可以运行 `yarn demo04` 查看运行效果

### 7、优化 `EventEmitter`

`Proxy` 版的 `MobX` 还是会有一些小问题: **em.list 的长度会随着 autorun 的调用越来越大**。

这是因为我们只有订阅操作，但是没有取消订阅的操作。

核心原因是 之前的代码中我们用自增ID来确定唯一的信道，这是有问题的。

怎么解决呢？我们可以参考 `Proxy` 的思路，把对象当作 key，来改造 `EventEmitter`。

改造后的代码如下，参考 `./utils/event-emitter-with-weakmap.ts`：

```ts
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
```

基于 `demo04`， 我们再重构一下 `Mobx` 代码，参考 `./demo05/mobx.ts`：

```ts
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
  return new Proxy(obj, {
    get: (target, propKey) => {
      if (typeof target[propKey] === 'object') {
        return observable(target[propKey]);
      } else {
        if (currentFn) {
          em.on(target, propKey, currentFn);
        }
        return target[propKey];
      }
    },
    set: (target, propKey, value) => {
      if (target[propKey] !== value) {
        target[propKey] = value;
        em.emit(target, propKey);
      }
      return true;
    }
  });
};
```

上面代码中，我们完全移除了使用自增ID来确定唯一信道。并且将 `WeakMap` 封装在 `EventEmitter` 中，`MobX`的代码也变得非常清爽。

> 感兴趣的同学可以运行 `yarn demo05` 查看运行效果

顺带的，我们也可以优化一下 `defineProperty` 版的 `Mobx`，移除其中的自增ID，参考 `./demo06/mobx.ts`：

```ts
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
```

> 感兴趣的同学可以运行 `yarn demo06` 查看运行效果

## 总结

这篇教程中，我们实现了包含 `observable`、`autorun` 两个核心功能的 `Mobx`。

并且可观察对象支持嵌套、自动收集依赖。

另外，我们分别用 `defineProperty` 和 `Proxy` 写法实现了这个 `Mobx`。

希望通过这篇教程，读者能够对 `Mobx` 的底层有更深刻的认识。

这些例子的完整代码可以[点这里](https://github.com/WangYuLue/simple-mobx)查看，如果感觉这些 demo 写的不错，可以给笔者一个 star，谢谢大家阅读。

## 相关阅读

[Mobx 文档](https://mobx.js.org/README.html)

[MobX 原理](https://github.com/sorrycc/blog/issues/3)

[MobX 源码探究](https://malcolmyu.github.io/2018/09/09/Core-Concepts-of-Mobx/)

[MobX 简明教程](https://github.com/whinc/blog/issues/16)

[使用 Mobx + Hooks 管理 React 应用状态](https://github.com/olivewind/blog/issues/5)

[Mobx React -- 最佳实践](http://dengxinbo.cn/2019/11/17/%E3%80%90%E7%BF%BB%E8%AF%91%E3%80%91mobx-react-%E6%9C%80%E4%BD%B3%E5%AE%9E%E8%B7%B5/)

[Hooks & Mobx 只需额外知道两个 Hook，便能体验到如此简单的开发方式](https://zhuanlan.zhihu.com/p/138226768)