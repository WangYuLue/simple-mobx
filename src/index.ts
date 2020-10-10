import { observable, autorun } from "./core/mobx";

// 1. 定义状态
const store = observable({
  count: 0,
  obj: {
    a: 1,
    b: 2
  }
});

// 2. 响应状态
autorun(() => {
  console.log("count:", store.obj.a,);
});
// count: 0

// 3. 修改状态
store.obj.a = 10