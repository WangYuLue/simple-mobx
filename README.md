# 实现一个简单的 MobX

## 导读

Mobx 是 React 常用的状态管理库。他有很多有点

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

为了方便读者更好的阅读体验，笔者将循序渐进的分多个demo来实现一个简单的 MobX。

### 1、Mobx 与 订阅发布模式 对比

仔细观察我们刚才写的例子：

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

尝试运行 `demo01/index.ts`：

```ts
import { observable, autorun } from './mobx';

const store = observable({ a: 1, b: 2 });

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

我们发现运行结果和使用原生的 `observable`、`autorun` 运行结果一致。

### 相关阅读

[Mobx 文档](https://mobx.js.org/README.html)
[MobX 原理](https://github.com/sorrycc/blog/issues/3)
[MobX 源码探究](https://malcolmyu.github.io/2018/09/09/Core-Concepts-of-Mobx/)
[MobX 简明教程](https://github.com/whinc/blog/issues/16)
[使用 Mobx + Hooks 管理 React 应用状态](https://github.com/olivewind/blog/issues/5)
[Mobx React -- 最佳实践](http://dengxinbo.cn/2019/11/17/%E3%80%90%E7%BF%BB%E8%AF%91%E3%80%91mobx-react-%E6%9C%80%E4%BD%B3%E5%AE%9E%E8%B7%B5/)
[Hooks & Mobx 只需额外知道两个 Hook，便能体验到如此简单的开发方式](https://zhuanlan.zhihu.com/p/138226768)